//! The tools: reversing, cropping, reducing, timestamps, merging, cleaning...

use gpx_engine::{self as engine, Command, LngLat, LngLatBounds};
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::session::*;
use crate::types::*;

// Tools

#[wasm_bindgen]
pub fn reverse() -> Outcome {
    edit(Command::Reverse(engine::Reverse))
}

/// Adds to each selected segment a reversed copy of itself (without repeating its last point), so that it goes back to where it
/// started.
#[wasm_bindgen]
pub fn round_trip() -> Outcome {
    edit(Command::RoundTrip(engine::RoundTrip))
}

/// Keeps the trackpoints `start` to `end` (both included) of the selection, counted over its
/// segments one after the other, and removes the others (and what is left empty).
#[wasm_bindgen]
pub fn crop(start: u32, end: u32) -> Outcome {
    if start > end {
        return fail(format!("the range {start}..{end} is reversed"));
    }
    edit(Command::Crop(engine::Crop { start, end }))
}

/// Removes the trackpoints of the selection that are less than `tolerance` meters away from the
/// line of their neighbours, except the ends of the segments.
#[wasm_bindgen]
pub fn reduce(tolerance: f64) -> Outcome {
    edit(Command::Reduce(engine::Reduce { tolerance }))
}

/// Sets the timestamps of the selection, which starts at `start_time` (ms since the epoch): the
/// trackpoints that have some keep their durations multiplied by `ratio`, the others follow the
/// previous one at `speed` (km/h).
#[wasm_bindgen(js_name = changeTimestamps)]
pub fn change_timestamps(start_time: f64, speed: f64, ratio: f64) -> Outcome {
    edit(Command::Time(engine::Time {
        start_time: start_time as i64,
        kind: engine::TimeKind::Change { speed, ratio },
    }))
}

/// Makes up timestamps for the selection, which starts at `start_time` (ms since the epoch) and
/// lasts `total_time` seconds.
#[wasm_bindgen(js_name = createArtificialTimestamps)]
pub fn create_artificial_timestamps(start_time: f64, total_time: f64) -> Outcome {
    edit(Command::Time(engine::Time {
        start_time: start_time as i64,
        kind: engine::TimeKind::Artificial { total_time },
    }))
}

/// Merges the selection into its first element (see `MergeType`). `remove_gaps` brings the parts
/// that are connected closer in time, if they have timestamps.
#[wasm_bindgen]
pub fn merge(type_: MergeType, remove_gaps: bool) -> Outcome {
    edit(Command::Merge(engine::Merge {
        type_: type_.into(),
        remove_gaps,
    }))
}

#[wasm_bindgen]
pub fn extract() -> Outcome {
    edit(Command::Extract(engine::Extract))
}

/// Sets the elevation of the trackpoints of the selection, one elevation per trackpoint.
#[wasm_bindgen]
pub fn elevation(ele: &[f64]) -> Outcome {
    edit(Command::Elevation(engine::Elevation { ele }))
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
    edit(Command::Clean(engine::Clean {
        bounds: LngLatBounds {
            sw: LngLat {
                lng: west,
                lat: south,
            },
            ne: LngLat {
                lng: east,
                lat: north,
            },
        },
        type_: type_.into(),
        trkpt,
        wpt,
    }))
}
