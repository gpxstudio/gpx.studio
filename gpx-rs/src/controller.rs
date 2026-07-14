use std::rc::Rc;

use wasm_bindgen::prelude::*;

use crate::{stack::Stack, types::GPXFile};

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
        let id = self.stack.get_new_file_id();
        let file = Rc::new(GPXFile::new(id, name));
        self.stack.update(&[file]);
    }
}
