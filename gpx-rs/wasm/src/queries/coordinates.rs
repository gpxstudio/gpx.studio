//! The coordinates of the trackpoints and waypoints, as flat typed arrays.

use gpx_engine::{self as engine, Engine, FileId};
use js_sys::Float64Array;
use wasm_bindgen::prelude::*;

use crate::session::*;

// Coordinates buffers
//
// Like the statistics buffers, these are copies. They are flat `[lng, lat, ...]` arrays. Compare `rev` / `waypointsRev` of the file structures with the previous ones to know which
// buffers actually changed.

pub(crate) fn coordinates_array(f: impl FnOnce(&Engine) -> Option<&[f64]>) -> Float64Array {
    ENGINE.with(|engine| match engine.borrow().as_ref().and_then(f) {
        Some(coordinates) => Float64Array::from(coordinates),
        None => Float64Array::new_with_length(0),
    })
}

/// Coordinates of the trackpoints of a segment (empty if the id is unknown).
#[wasm_bindgen]
pub fn segment_coordinates(segment_id: &str) -> Float64Array {
    match uuid::Uuid::parse_str(segment_id) {
        Ok(id) => coordinates_array(|e| Some(e.segment_coordinates(&engine::TrackSegmentId(id)))),
        Err(_) => Float64Array::new_with_length(0),
    }
}

/// Coordinates of the waypoints of a file (empty if the id is unknown).
#[wasm_bindgen]
pub fn waypoint_coordinates(file_id: &str) -> Float64Array {
    match uuid::Uuid::parse_str(file_id) {
        Ok(id) => coordinates_array(|e| Some(e.waypoint_coordinates(&FileId(id)))),
        Err(_) => Float64Array::new_with_length(0),
    }
}
