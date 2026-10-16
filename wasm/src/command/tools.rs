//! The tools: reversing, cropping, reducing, timestamps, merging, cleaning...

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::session::*;
use crate::types::*;

// Tools

#[wasm_bindgen]
pub fn reverse() -> Outcome {
    run(api::reverse)
}

/// Adds to each selected segment a reversed copy of itself (without repeating its last point), so that it goes back to where it
/// started.
#[wasm_bindgen]
pub fn round_trip() -> Outcome {
    run(api::round_trip)
}

/// Keeps the trackpoints `start` to `end` (both included) of the selection, counted over its
/// segments one after the other, and removes the others (and what is left empty).
#[wasm_bindgen]
pub fn crop(start: u32, end: u32) -> Outcome {
    run(|e| api::crop(e, start, end))
}

/// Removes the trackpoints of the selection that are less than `tolerance` meters away from the
/// line of their neighbours, except the ends of the segments.
#[wasm_bindgen]
pub fn reduce(tolerance: f64) -> Outcome {
    run(|e| api::reduce(e, tolerance))
}

/// Sets the timestamps of the selection, which starts at `start_time` (ms since the epoch): the
/// trackpoints that have some keep their durations multiplied by `ratio`, the others follow the
/// previous one at `speed` (km/h).
#[wasm_bindgen(js_name = changeTimestamps)]
pub fn change_timestamps(start_time: f64, speed: f64, ratio: f64) -> Outcome {
    run(|e| api::change_timestamps(e, start_time, speed, ratio))
}

/// Makes up timestamps for the selection, which starts at `start_time` (ms since the epoch) and
/// lasts `total_time` seconds.
#[wasm_bindgen(js_name = createArtificialTimestamps)]
pub fn create_artificial_timestamps(start_time: f64, total_time: f64) -> Outcome {
    run(|e| api::create_artificial_timestamps(e, start_time, total_time))
}

/// Merges the selection into its first element (see `MergeType`). `remove_gaps` brings the parts
/// that are connected closer in time, if they have timestamps.
#[wasm_bindgen]
pub fn merge(type_: MergeType, remove_gaps: bool) -> Outcome {
    run(|e| api::merge(e, type_.into(), remove_gaps))
}

#[wasm_bindgen]
pub fn extract() -> Outcome {
    run(api::extract)
}

/// Sets the elevation of the trackpoints of the selection, one elevation per trackpoint.
#[wasm_bindgen]
pub fn elevation(ele: &[f64]) -> Outcome {
    run(|e| api::elevation(e, ele))
}

#[wasm_bindgen]
pub fn clean(
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    type_: CleanType,
    trkpt: bool,
    wpt: bool,
) -> Outcome {
    run(|e| api::clean(e, west, south, east, north, type_.into(), trkpt, wpt))
}
