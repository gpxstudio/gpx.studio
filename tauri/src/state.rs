//! The state the commands share: the engine, and what goes with it.
//!
//! The engine is not `Send` (it shares its data with `Rc`), so it lives on a thread of its own with
//! everything that works on it (its storage, the link between its files and the file system, the
//! watcher of the open folder), and the commands send that thread jobs: they are done one after the
//! other, in the order they were sent.

use std::path::PathBuf;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::Engine;
use gpx_engine::{Persister, Storage, api};
use notify::RecursiveMode;
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use serde::Serialize;

use crate::store::FileStorage;
use crate::workspace::{Workspace, WorkspaceState, signature};

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
    /// What the watcher watches, see `Workspace::watched`.
    watching: Vec<(PathBuf, bool)>,
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
            watching: vec![],
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
        let outcome = self.workspace.open(&mut self.engine, paths, false);
        (self.emit)("files-opened", to_json(&outcome));
        self.commit(None);
    }

    /// Runs `f` on the engine, which can change: what changed is kept, and the files on the disk are
    /// renamed like the files of the engine were (an edit of the name, or its undo). Gives what
    /// could not be renamed.
    fn editing<T>(&mut self, f: impl FnOnce(&mut Engine) -> T) -> (T, Vec<String>) {
        let names = self.workspace.names(&self.engine);
        let preview = self.workspace.preview;
        let preview_before = preview.and_then(|id| signature(&self.engine, id));
        let result = f(&mut self.engine);
        // the preview is open for good once something is done to it
        let kept = preview.is_some_and(|id| signature(&self.engine, id) != preview_before);
        if let Some(id) = preview.filter(|_| kept) {
            self.workspace.keep(&[id]);
        }
        let (renamed, errors) = self.workspace.follow_names(&mut self.engine, &names);
        // and it goes when something else is selected
        let dropped = self.workspace.drop_preview(&mut self.engine);
        if kept || renamed || dropped.is_some() {
            self.commit(dropped.as_ref());
        } else {
            self.persist();
        }
        (result, errors)
    }

    /// Like `editing`, for an edit that can rename files: the outcome tells the first thing that
    /// could not be renamed (a key of the dictionaries of the frontend, which shows it).
    pub fn edit(&mut self, f: impl FnOnce(&mut Engine) -> api::Outcome) -> api::Outcome {
        let (outcome, errors) = self.editing(f);
        match errors.first() {
            Some(error) if !outcome.has_error() => {
                outcome.merge(api::Outcome::failed(error.clone()))
            }
            _ => outcome,
        }
    }

    /// After files were written (`result`): what changed in the engine (the files are called like
    /// the files they were written to) is kept and told, with where the files are. Says whether
    /// they were written.
    pub fn wrote(&mut self, result: Result<api::Outcome, String>) -> Result<bool, String> {
        self.commit(result.as_ref().ok().filter(|outcome| outcome.changed));
        result.map(|_| true)
    }

    /// After a change of the files or of where they are: the workspace and the engine are kept, and
    /// the frontend is told (`outcome` is what changed in the engine, if it did not ask for it).
    pub fn commit(&mut self, outcome: Option<&api::Outcome>) {
        self.keep_workspace();
        self.persist();
        self.announce(outcome);
    }

    /// Writes the workspace, and watches what it holds (a file may have been opened or closed).
    pub fn keep_workspace(&mut self) {
        self.workspace.write(self.storage.root());
        self.watch();
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

    /// Watches the open folder, and the folders of the files that are linked outside of it. Does
    /// nothing if that is what is watched already.
    pub fn watch(&mut self) {
        let wanted = self.workspace.watched();
        if wanted == self.watching && (self.watcher.is_some() || wanted.is_empty()) {
            return;
        }
        self.watcher = None;
        self.watching = wanted.clone();
        if wanted.is_empty() {
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
                for (path, recursive) in &wanted {
                    let mode = if *recursive {
                        RecursiveMode::Recursive
                    } else {
                        RecursiveMode::NonRecursive
                    };
                    if let Err(error) = debouncer.watcher().watch(path, mode) {
                        eprintln!("{} cannot be watched: {error}", path.display());
                    }
                }
                self.watcher = Some(debouncer);
            }
            Err(error) => eprintln!("the files cannot be watched: {error}"),
        }
    }

    fn on_disk_changed(&mut self, paths: &[PathBuf]) {
        // the tree of the folder shows the disk
        let in_folder: Vec<&PathBuf> = paths
            .iter()
            .filter(|path| {
                self.workspace
                    .folder
                    .as_ref()
                    .is_some_and(|f| path.starts_with(f))
            })
            .collect();
        if !in_folder.is_empty() {
            (self.emit)("folder-changed", to_json(&in_folder));
        }
        if let Some(outcome) = self.workspace.reconcile(&mut self.engine, Some(paths)) {
            self.commit(Some(&outcome));
        }
    }

    /// Runs `f`, which creates files (a new file, a copy, the result of a split...). Where they go
    /// when they are saved is the folder of the files they come from (the selected ones, before
    /// `f`), if it is in the open folder. `default_folder` says whether a file with nothing to
    /// come from goes in the open folder: a new file does.
    pub fn creating(
        &mut self,
        folder: Option<PathBuf>,
        default_folder: bool,
        f: impl FnOnce(&mut Engine) -> api::Outcome,
    ) -> api::Outcome {
        let selected: Vec<uuid::Uuid> = self
            .engine
            .selection()
            .file_ids()
            .into_iter()
            .map(|gpx_engine::FileId(id)| id)
            .collect();
        let dir = folder
            .map(|folder| crate::workspace::canonical(&folder))
            .or_else(|| self.workspace.source_dir(&selected))
            .or_else(|| {
                default_folder
                    .then(|| self.workspace.folder.clone())
                    .flatten()
            });
        let mut outcome = f(&mut self.engine);
        if let Some(dir) = dir {
            self.workspace.inherit(outcome.added(), &dir);
            // what is made in a folder is written there at once, so that the tree shows it
            let made: Vec<uuid::Uuid> = outcome
                .added()
                .iter()
                .filter_map(|id| uuid::Uuid::parse_str(id).ok())
                .filter(|id| self.workspace.dirs.contains_key(id))
                .collect();
            match self.workspace.save_new(&mut self.engine, &made) {
                Ok(renamed) => outcome = outcome.merge(renamed),
                Err(error) if !outcome.has_error() => {
                    outcome = outcome.merge(api::Outcome::failed(error));
                }
                Err(_) => {}
            }
        }
        self.commit(None);
        outcome
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

    /// Runs `f` on the engine, which can change: what changed is kept (see `Core::editing`).
    pub fn run<T: Send + 'static>(&self, f: impl FnOnce(&mut Engine) -> T + Send + 'static) -> T {
        self.core(move |core| {
            let (result, errors) = core.editing(f);
            for error in errors {
                eprintln!("{error}");
            }
            result
        })
    }

    /// Like `run`, for an edit that can rename files: the outcome tells what could not be renamed.
    pub fn edit(
        &self,
        f: impl FnOnce(&mut Engine) -> api::Outcome + Send + 'static,
    ) -> api::Outcome {
        self.core(move |core| core.edit(f))
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
