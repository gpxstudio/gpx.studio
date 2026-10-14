//! The state the commands share: the engine, and what goes with it.
//!
//! The engine is not `Send` (it shares its data with `Rc`), so it lives on a thread of its own with
//! everything that works on it (its storage, the link between its files and the file system, the
//! watcher of the open folder), and the commands send that thread jobs: they are done one after the
//! other, in the order they were sent.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use gpx_engine::{Engine, Persister, Storage, api};
use notify::RecursiveMode;
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use serde::Serialize;

use crate::store::FileStorage;
use crate::workspace::{Workspace, WorkspaceState};

/// Tells the frontend that something happened that it did not ask for: a name and a JSON value.
pub type Emit = Arc<dyn Fn(&str, serde_json::Value) + Send + Sync>;

type Job = Box<dyn FnOnce(&mut Core) + Send>;

/// Everything that lives on the thread of the engine.
pub struct Core {
    pub engine: Engine,
    pub workspace: Workspace,
    storage: Arc<FileStorage>,
    persister: Persister,
    watcher: Option<Debouncer<notify::RecommendedWatcher>>,
    jobs: Sender<Job>,
    emit: Emit,
}

#[derive(Clone)]
pub struct AppState {
    jobs: Arc<Mutex<Sender<Job>>>,
    storage: Arc<FileStorage>,
}

impl Core {
    fn start(storage: Arc<FileStorage>, jobs: Sender<Job>, emit: Emit) -> Self {
        let mut core = Self {
            engine: Engine::default(),
            workspace: Workspace::load(storage.root()),
            persister: Persister::default(),
            storage,
            watcher: None,
            jobs,
            emit,
        };
        match pollster::block_on(core.persister.restore(&*core.storage)) {
            Ok(restored) => {
                core.engine.restore(restored);
            }
            // what is stored comes from a newer version, which is left alone
            Err(gpx_engine::StorageError::Newer) => {}
            Err(error) => eprintln!("the files could not be read: {error}"),
        }
        core.workspace.prune(&core.engine);
        core.workspace.verify(&core.engine);
        // what happened on the disk while the app was closed
        core.workspace.reconcile(&mut core.engine, None);
        core.workspace.write(core.storage.root());
        core.watch();
        core.persist();
        core
    }

    /// Writes what changed in the engine.
    pub fn persist(&mut self) {
        match pollster::block_on(self.persister.save(&*self.storage, self.engine.snapshot())) {
            Ok(()) | Err(gpx_engine::CommitError::Failed(gpx_engine::StorageError::Newer)) => {}
            Err(error) => eprintln!("the files could not be kept: {error}"),
        }
    }

    /// Opens files that the system gave to the app (open with..., double click, the command line),
    /// which get selected. The frontend is told, if it already runs: when it starts it reads what
    /// the engine has.
    pub fn open_external(&mut self, paths: &[PathBuf]) {
        if paths.is_empty() {
            return;
        }
        let outcome = self.workspace.open_files(&mut self.engine, paths, true);
        self.keep_workspace();
        self.persist();
        (self.emit)("files-opened", to_json(&outcome));
        self.announce(None);
    }

    pub fn keep_workspace(&self) {
        self.workspace.write(self.storage.root());
    }

    pub fn workspace_state(&self) -> WorkspaceState {
        self.workspace.state(&self.engine)
    }

    /// Tells the frontend what changed without it asking, and where the files are.
    pub fn announce(&self, outcome: Option<&api::Outcome>) {
        if let Some(outcome) = outcome {
            (self.emit)("engine-changed", to_json(outcome));
        }
        (self.emit)("workspace-changed", to_json(&self.workspace_state()));
    }

    /// Watches the open folder (and only it).
    pub fn watch(&mut self) {
        self.watcher = None;
        let Some(folder) = self.workspace.folder.clone() else {
            return;
        };
        if !Path::new(&folder).is_dir() {
            return;
        }
        let jobs = self.jobs.clone();
        let debouncer = new_debouncer(
            Duration::from_millis(400),
            move |result: DebounceEventResult| {
                let Ok(events) = result else { return };
                let paths: Vec<PathBuf> = events.into_iter().map(|event| event.path).collect();
                let _ = jobs.send(Box::new(move |core: &mut Core| {
                    core.on_disk_changed(&paths)
                }));
            },
        );
        match debouncer {
            Ok(mut debouncer) => {
                match debouncer.watcher().watch(&folder, RecursiveMode::Recursive) {
                    Ok(()) => self.watcher = Some(debouncer),
                    Err(error) => eprintln!("the folder cannot be watched: {error}"),
                }
            }
            Err(error) => eprintln!("the folder cannot be watched: {error}"),
        }
    }

    fn on_disk_changed(&mut self, paths: &[PathBuf]) {
        let outcome = self.workspace.reconcile(&mut self.engine, Some(paths));
        if let Some(outcome) = outcome {
            self.workspace.write(self.storage.root());
            self.persist();
            self.announce(Some(&outcome));
        }
    }
}

fn to_json<T: Serialize>(value: &T) -> serde_json::Value {
    serde_json::to_value(value).unwrap_or_default()
}

impl AppState {
    /// Starts the engine, which restores what was kept in `directory`.
    pub fn open(directory: impl Into<PathBuf>, emit: Emit) -> Result<Self, String> {
        let storage = Arc::new(FileStorage::open(directory).map_err(|error| error.to_string())?);
        let (jobs, receiver) = mpsc::channel::<Job>();
        let (thread_storage, thread_jobs) = (storage.clone(), jobs.clone());
        thread::Builder::new()
            .name("engine".into())
            .spawn(move || {
                let mut core = Core::start(thread_storage, thread_jobs, emit);
                while let Ok(job) = receiver.recv() {
                    job(&mut core);
                }
            })
            .map_err(|error| error.to_string())?;
        Ok(Self {
            jobs: Arc::new(Mutex::new(jobs)),
            storage,
        })
    }

    /// An engine that keeps its data in a directory of its own, and has nobody to tell.
    #[cfg(test)]
    pub fn temporary() -> Self {
        let directory = std::env::temp_dir().join(format!("gpx-studio-{}", uuid::Uuid::new_v4()));
        Self::open(directory, Arc::new(|_, _| {})).expect("the storage can be opened")
    }

    /// Opens files that the system gave to the app, see `Core::open_external`.
    pub fn open_external(&self, paths: Vec<PathBuf>) {
        self.core(move |core| core.open_external(&paths));
    }

    /// Runs `f` on the thread of the engine and waits for its result.
    pub fn core<T: Send + 'static>(&self, f: impl FnOnce(&mut Core) -> T + Send + 'static) -> T {
        let (reply, result) = mpsc::channel();
        let job: Job = Box::new(move |core| {
            let _ = reply.send(f(core));
        });
        self.jobs
            .lock()
            .unwrap()
            .send(job)
            .expect("the engine thread stopped");
        result.recv().expect("the engine thread stopped")
    }

    /// Runs `f` on the engine, which can change: what changed is kept.
    pub fn run<T: Send + 'static>(&self, f: impl FnOnce(&mut Engine) -> T + Send + 'static) -> T {
        self.core(move |core| {
            let result = f(&mut core.engine);
            core.persist();
            result
        })
    }

    /// Reads from the engine.
    pub fn read<T: Send + 'static>(&self, f: impl FnOnce(&Engine) -> T + Send + 'static) -> T {
        self.core(move |core| f(&core.engine))
    }

    pub fn storage(&self) -> &FileStorage {
        &self.storage
    }
}

// the settings only are read and written by the commands, from any thread
impl AppState {
    pub fn put_setting(&self, key: &str, value: &str) {
        if let Err(error) = pollster::block_on(self.storage.put_setting(key, value)) {
            eprintln!("the setting could not be kept: {error}");
        }
    }

    pub fn delete_setting(&self, key: &str) {
        if let Err(error) = pollster::block_on(self.storage.delete_setting(key)) {
            eprintln!("the setting could not be kept: {error}");
        }
    }
}
