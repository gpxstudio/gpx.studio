//! The statistics of the selection, as typed arrays, and the categories they refer to.

use gpx_engine::api;
use js_sys::{BigInt64Array, Float64Array, Uint8Array, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::session::*;
use crate::ts::*;

// Statistics buffers
//
// Each getter returns a copy of the buffer, as a new JS typed array.

macro_rules! stats_getter {
    ($name:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> $array {
            with_engine(|e| $array::from(api::$name(e)))
                .unwrap_or_else(|| $array::new_with_length(0))
        }
    };
}

stats_getter!(total_distance, Float64Array);
stats_getter!(elevation_gain, Float64Array);
stats_getter!(elevation_loss, Float64Array);
stats_getter!(slope, Float64Array);
stats_getter!(slope_segment_slope, Float64Array);
stats_getter!(slope_segment_distance, Float64Array);
stats_getter!(lng, Float64Array);
stats_getter!(lat, Float64Array);
stats_getter!(ele, Float64Array);

// The optional values are `undefined` when no trackpoint of the selection has one, else they have
// an entry per trackpoint, the missing ones being NaN (`NO_TIME` for the timestamps, 0 before the
// first trackpoint that has them for the cumulative distances and durations).
macro_rules! optional_stats_getter {
    ($name:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> Option<$array> {
            with_engine(|e| api::$name(e).map($array::from)).flatten()
        }
    };
}

optional_stats_getter!(moving_distance, Float64Array);
// Durations since the start of the selection, in milliseconds.
optional_stats_getter!(total_time, BigInt64Array);
optional_stats_getter!(moving_time, BigInt64Array);
optional_stats_getter!(speed, Float64Array);
// Timestamps in milliseconds since the epoch (`NO_TIME`, the smallest i64, when missing).
optional_stats_getter!(timestamps, BigInt64Array);

/// Value of the timestamps of the trackpoints that have none.
#[wasm_bindgen]
pub fn no_time() -> i64 {
    gpx_engine::NO_TIME
}

optional_stats_getter!(hr, Float64Array);
optional_stats_getter!(cad, Float64Array);
optional_stats_getter!(atemp, Float64Array);
optional_stats_getter!(power, Float64Array);

// Surface, highway, SAC scale and MTB scale of the trackpoints, as intervals of trackpoints that
// have the same value: `<name>_starts` holds the index of the first trackpoint of each interval,
// and `<name>_values` its value (0 when unknown, else 1 + the index in `surfaces()`,
// `highways()`, `sac_scales()` or `mtb_scales()`). A value that is unknown for every trackpoint is
// a single interval.
macro_rules! categories_getters {
    ($starts:ident, $values:ident, $names:ident) => {
        #[wasm_bindgen]
        pub fn $starts() -> Uint32Array {
            with_engine(|e| Uint32Array::from(api::$starts(e)))
                .unwrap_or_else(|| Uint32Array::new_with_length(0))
        }

        #[wasm_bindgen]
        pub fn $values() -> Uint8Array {
            with_engine(|e| Uint8Array::from(api::$values(e)))
                .unwrap_or_else(|| Uint8Array::new_with_length(0))
        }

        /// The names of the category, in the order of their codes. The list only grows: a name
        /// keeps its index.
        #[wasm_bindgen]
        pub fn $names() -> StringList {
            to_js(&with_engine(|e| api::$names(e).to_vec()).unwrap_or_default()).unchecked_into()
        }
    };
}

categories_getters!(surface_starts, surface_values, surfaces);
categories_getters!(highway_starts, highway_values, highways);
categories_getters!(sac_scale_starts, sac_scale_values, sac_scales);
categories_getters!(mtb_scale_starts, mtb_scale_values, mtb_scales);

/// For each trackpoint of the selection (numbered as in the statistics), the highest tolerance
/// (m) of `reduce` that keeps it: infinite for the ends of the segments.
#[wasm_bindgen]
pub fn reduction_distances() -> Float64Array {
    with_engine(|e| Float64Array::from(&api::reduction_distances(e)[..]))
        .unwrap_or_else(|| Float64Array::new_with_length(0))
}
