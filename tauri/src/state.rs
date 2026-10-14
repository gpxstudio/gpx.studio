//! The state the commands share: the engine, and the settings of the frontend.
//!
//! The engine is not `Send` (it shares its data with `Rc`), so it lives on a thread of its own and
//! the commands send it jobs: they are done one after the other, in the order they were sent.

use std::collections::BTreeMap;
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, MutexGuard};
use std::thread;

use gpx_engine::Engine;

type Job = Box<dyn FnOnce(&mut Engine) + Send>;

pub struct AppState {
    jobs: Mutex<Sender<Job>>,
    /// The settings of the frontend, as JSON strings by key.
    settings: Mutex<BTreeMap<String, String>>,
}

impl Default for AppState {
    fn default() -> Self {
        let (jobs, receiver) = mpsc::channel::<Job>();
        thread::Builder::new()
            .name("engine".into())
            .spawn(move || {
                let mut engine = Engine::default();
                while let Ok(job) = receiver.recv() {
                    job(&mut engine);
                }
            })
            .expect("the engine thread could not be started");
        Self {
            jobs: Mutex::new(jobs),
            settings: Mutex::default(),
        }
    }
}

impl AppState {
    /// Runs `f` on the engine and waits for its result.
    pub fn run<T: Send + 'static>(&self, f: impl FnOnce(&mut Engine) -> T + Send + 'static) -> T {
        let (reply, result) = mpsc::channel();
        let job: Job = Box::new(move |engine| {
            let _ = reply.send(f(engine));
        });
        self.jobs
            .lock()
            .unwrap()
            .send(job)
            .expect("the engine thread stopped");
        result.recv().expect("the engine thread stopped")
    }

    /// Reads from the engine.
    pub fn read<T: Send + 'static>(&self, f: impl FnOnce(&Engine) -> T + Send + 'static) -> T {
        self.run(move |engine| f(engine))
    }

    pub fn settings(&self) -> MutexGuard<'_, BTreeMap<String, String>> {
        self.settings.lock().unwrap()
    }
}
