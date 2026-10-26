//! Editing the metadata, the style and the structure of the files.

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::session::*;
use crate::ts::Outcome;

// Edit commands

#[wasm_bindgen]
pub fn metadata(name: &str, desc: &str) -> Outcome {
    run(|e| api::metadata(e, name, desc))
}

#[wasm_bindgen]
pub fn style(color: Option<String>, opacity: Option<f64>, width: Option<f64>) -> Outcome {
    run(|e| api::style(e, color.as_deref(), opacity, width))
}

#[wasm_bindgen]
pub fn new_route() -> Outcome {
    run(api::new_route)
}

#[wasm_bindgen]
pub fn new_track() -> Outcome {
    run(api::new_track)
}

#[wasm_bindgen]
pub fn new_track_segment() -> Outcome {
    run(api::new_track_segment)
}
