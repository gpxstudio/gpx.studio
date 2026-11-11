//! Undo and redo.

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::session::*;
use crate::ts::Outcome;

// Undo-redo

#[wasm_bindgen]
pub fn undo() -> Outcome {
    run(api::undo)
}

#[wasm_bindgen]
pub fn redo() -> Outcome {
    run(api::redo)
}

#[wasm_bindgen]
pub fn can_undo() -> bool {
    with_engine(api::can_undo).unwrap_or(false)
}

#[wasm_bindgen]
pub fn can_redo() -> bool {
    with_engine(api::can_redo).unwrap_or(false)
}
