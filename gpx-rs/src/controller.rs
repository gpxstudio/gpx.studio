use std::rc::Rc;

use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::{
    actions::parse,
    gpx::GPXFile,
    stack::{Stack, StackEntry},
};

// Control flow
// - get lock to cancel any other updates
// - update files
// - update separate statistics
// - update selection
// - update selection statistics
// - notify UI (changed files, updated selection, new stats)

#[wasm_bindgen]
pub struct Controller {
    stack: Stack,
}

#[wasm_bindgen]
impl Controller {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            stack: Stack::default(),
        }
    }

    #[wasm_bindgen]
    pub fn create_file(&mut self, name: &str) {
        let mut file = GPXFile::default();
        file.info.name = name.to_string();
        self.stack.create_and_push_next(|entry: &mut StackEntry| {
            entry.insert(file.id, Rc::new(file));
            true
        });
    }

    #[wasm_bindgen]
    pub fn load_file(&mut self, data: &[u8]) {
        if let Ok(file) = parse(data) {
            self.stack.create_and_push_next(|entry: &mut StackEntry| {
                entry.insert(file.id, Rc::new(file));
                true
            });
        }
    }

    #[wasm_bindgen]
    pub fn delete_file(&mut self, id: &[u8]) {
        if let Ok(id) = Uuid::from_slice(id) {
            self.stack
                .create_and_push_next(|entry: &mut StackEntry| entry.remove(&id).is_some());
        }
    }
}
