//! Undo and redo.

use gpx_engine::Action;
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::session::*;

// Undo-redo

#[wasm_bindgen]
pub fn undo() -> Outcome {
    execute(Action::Undo)
}

#[wasm_bindgen]
pub fn redo() -> Outcome {
    execute(Action::Redo)
}

#[wasm_bindgen]
pub fn can_undo() -> bool {
    with_engine(|e| e.can_undo()).unwrap_or(false)
}

#[wasm_bindgen]
pub fn can_redo() -> bool {
    with_engine(|e| e.can_redo()).unwrap_or(false)
}
