//! The coordinates of the trackpoints and waypoints, as flat typed arrays.

use gpx_engine::api;
use js_sys::Float64Array;
use wasm_bindgen::prelude::*;

use crate::ids::*;
use crate::session::*;

// Coordinates buffers
//
// Like the statistics buffers, these are copies. They are flat `[lng, lat, ...]` arrays. Compare `rev` / `waypointsRev` of the file structures with the previous ones to know which
// buffers actually changed.

fn coordinates(
    id: Option<uuid::Uuid>,
    f: impl FnOnce(&gpx_engine::Engine, uuid::Uuid) -> &[f64],
) -> Float64Array {
    id.and_then(|id| with_engine(|e| Float64Array::from(f(e, id))))
        .unwrap_or_else(|| Float64Array::new_with_length(0))
}

/// Coordinates of the trackpoints of a segment (empty if the id is unknown).
#[wasm_bindgen]
pub fn segment_coordinates(segment_id: &str) -> Float64Array {
    coordinates(parse_uuid(segment_id), api::segment_coordinates)
}

/// Coordinates of the waypoints of a file (empty if the id is unknown).
#[wasm_bindgen]
pub fn waypoint_coordinates(file_id: &str) -> Float64Array {
    coordinates(parse_uuid(file_id), api::waypoint_coordinates)
}
