//! The statistics of the selection, as typed arrays, and the categories they refer to.

use gpx_engine as engine;
use js_sys::{BigInt64Array, Float64Array, Uint8Array, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::session::*;
use crate::ts::*;

// Statistics buffers
//
// Each getter returns a copy of the buffer, as a new JS typed array.

pub(crate) fn with_stats<T>(f: impl FnOnce(&engine::StatisticsBuffer) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow().as_ref().map(|e| f(e.statistics())))
}

macro_rules! stats_getter {
    ($name:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> $array {
            with_stats(|s| $array::from(&s.$name[..])).unwrap_or_else(|| $array::new_with_length(0))
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
    ($name:ident, $field:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> Option<$array> {
            with_stats(|s| s.$field.as_deref().map($array::from)).flatten()
        }
    };
}

optional_stats_getter!(moving_distance, moving_distance, Float64Array);
// Durations since the start of the selection, in milliseconds.
optional_stats_getter!(total_time, total_time, BigInt64Array);
optional_stats_getter!(moving_time, moving_time, BigInt64Array);
optional_stats_getter!(speed, speed, Float64Array);
// Timestamps in milliseconds since the epoch (`NO_TIME`, the smallest i64, when missing).
optional_stats_getter!(timestamps, time, BigInt64Array);

/// Value of the timestamps of the trackpoints that have none.
#[wasm_bindgen]
pub fn no_time() -> i64 {
    engine::NO_TIME
}

optional_stats_getter!(hr, hr, Float64Array);
optional_stats_getter!(cad, cad, Float64Array);
optional_stats_getter!(atemp, atemp, Float64Array);
optional_stats_getter!(power, power, Float64Array);

// Surface, highway, SAC scale and MTB scale of the trackpoints, as intervals of trackpoints that
// have the same value: `<name>_starts` holds the index of the first trackpoint of each interval,
// and `<name>_values` its value (0 when unknown, else 1 + the index in `surfaces()`,
// `highways()`, `sac_scales()` or `mtb_scales()`). A value that is unknown for every trackpoint is
// a single interval.
macro_rules! intervals_getters {
    ($starts:ident, $values:ident, $field:ident) => {
        #[wasm_bindgen]
        pub fn $starts() -> Uint32Array {
            with_stats(|s| Uint32Array::from(&s.$field.starts[..]))
                .unwrap_or_else(|| Uint32Array::new_with_length(0))
        }

        #[wasm_bindgen]
        pub fn $values() -> Uint8Array {
            with_stats(|s| Uint8Array::from(&s.$field.values[..]))
                .unwrap_or_else(|| Uint8Array::new_with_length(0))
        }
    };
}

intervals_getters!(surface_starts, surface_values, surface);
intervals_getters!(highway_starts, highway_values, highway);
intervals_getters!(sac_scale_starts, sac_scale_values, sac_scale);
intervals_getters!(mtb_scale_starts, mtb_scale_values, mtb_scale);

/// The names of the surfaces, in the order of their codes (see `surface_values`). The list only grows:
/// a name keeps its index.
#[wasm_bindgen]
pub fn surfaces() -> StringList {
    with_engine(|e| array(e.categories().surface.names(), |name| name.as_str().into()))
        .unwrap_or_default()
        .unchecked_into()
}

/// The names of the highways, in the order of their codes (see `highway_values`).
#[wasm_bindgen]
pub fn highways() -> StringList {
    with_engine(|e| array(e.categories().highway.names(), |name| name.as_str().into()))
        .unwrap_or_default()
        .unchecked_into()
}

/// The names of the SAC scales, in the order of their codes (see `sac_scale_values`).
#[wasm_bindgen]
pub fn sac_scales() -> StringList {
    with_engine(|e| {
        array(e.categories().sac_scale.names(), |name| {
            name.as_str().into()
        })
    })
    .unwrap_or_default()
    .unchecked_into()
}

/// The names of the MTB scales, in the order of their codes (see `mtb_scale_values`).
#[wasm_bindgen]
pub fn mtb_scales() -> StringList {
    with_engine(|e| {
        array(e.categories().mtb_scale.names(), |name| {
            name.as_str().into()
        })
    })
    .unwrap_or_default()
    .unchecked_into()
}

/// For each trackpoint of the selection (numbered as in the statistics), the highest tolerance
/// (m) of `reduce` that keeps it: infinite for the ends of the segments.
#[wasm_bindgen]
pub fn reduction_distances() -> Float64Array {
    with_engine(|e| Float64Array::from(&e.reduction_distances()[..]))
        .unwrap_or_else(|| Float64Array::new_with_length(0))
}
