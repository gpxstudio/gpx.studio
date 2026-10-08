//! Editing the metadata, the style and the structure of the files.

use gpx_engine::{self as engine, Command};
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::session::*;

// Edit commands

#[wasm_bindgen]
pub fn metadata(name: &str, desc: &str) -> Outcome {
    edit(Command::Metadata(engine::Metadata { name, desc }))
}

#[wasm_bindgen]
pub fn style(color: Option<String>, opacity: Option<f64>, width: Option<f64>) -> Outcome {
    edit(Command::Style(engine::Style {
        color: color.as_deref(),
        opacity,
        width,
    }))
}

#[wasm_bindgen]
pub fn new_track() -> Outcome {
    edit(Command::NewTrack(engine::NewTrack))
}

#[wasm_bindgen]
pub fn new_track_segment() -> Outcome {
    edit(Command::NewTrackSegment(engine::NewTrackSegment))
}
