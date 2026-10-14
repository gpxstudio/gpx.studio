//! The statistics of the selection and the anchors of the routing tool, as little-endian arrays
//! (one per call, copies of the buffers of the engine). Optional ones start with a byte telling
//! whether they are there.

use gpx_engine::api;
use tauri::State;

use crate::bytes::*;
use crate::state::AppState;

macro_rules! f64_getters {
    ($($name:ident),*) => {$(
        #[tauri::command(async)]
        pub fn $name(state: State<AppState>) -> Bytes {
            f64s(&state.read(|e| api::$name(e).to_vec()))
        }
    )*};
}

f64_getters!(
    total_distance,
    slope,
    slope_segment_slope,
    slope_segment_distance,
    lng,
    lat,
    ele
);

macro_rules! optional_f64_getters {
    ($($name:ident),*) => {$(
        #[tauri::command(async)]
        pub fn $name(state: State<AppState>) -> Bytes {
            optional(state.read(|e| api::$name(e).map(f64_bytes)))
        }
    )*};
}

optional_f64_getters!(speed, hr, cad, atemp, power);

/// Timestamps in milliseconds since the epoch (`NO_TIME` when missing), as `i64`.
#[tauri::command(async)]
pub fn timestamps(state: State<AppState>) -> Bytes {
    optional(state.read(|e| api::timestamps(e).map(i64_bytes)))
}

#[tauri::command(async)]
pub fn selection_statistics(state: State<AppState>) -> api::GlobalStatistics {
    state.read(api::selection_statistics)
}

#[tauri::command(async)]
pub fn slice_statistics(
    state: State<AppState>,
    start: usize,
    end: usize,
) -> Option<api::GlobalStatistics> {
    state.read(move |e| api::slice_statistics(e, start, end))
}

macro_rules! category_getters {
    ($starts:ident, $values:ident, $names:ident) => {
        #[tauri::command(async)]
        pub fn $starts(state: State<AppState>) -> Bytes {
            u32s(&state.read(|e| api::$starts(e).to_vec()))
        }

        #[tauri::command(async)]
        pub fn $values(state: State<AppState>) -> Bytes {
            u8s(&state.read(|e| api::$values(e).to_vec()))
        }

        #[tauri::command(async)]
        pub fn $names(state: State<AppState>) -> Vec<String> {
            state.read(|e| api::$names(e).to_vec())
        }
    };
}

category_getters!(surface_starts, surface_values, surfaces);
category_getters!(highway_starts, highway_values, highways);
category_getters!(sac_scale_starts, sac_scale_values, sac_scales);
category_getters!(mtb_scale_starts, mtb_scale_values, mtb_scales);

#[tauri::command(async)]
pub fn anchor_indices(state: State<AppState>) -> Bytes {
    u32s(&state.read(|e| api::anchor_indices(e).to_vec()))
}

#[tauri::command(async)]
pub fn anchor_zooms(state: State<AppState>) -> Bytes {
    u8s(&state.read(|e| api::anchor_zooms(e).to_vec()))
}

#[tauri::command(async)]
pub fn segment_starts(state: State<AppState>) -> Bytes {
    u32s(&state.read(|e| api::segment_starts(e).to_vec()))
}

#[tauri::command(async)]
pub fn segment_ids(state: State<AppState>) -> Vec<String> {
    state.read(api::segment_ids)
}

#[tauri::command(async)]
pub fn routing_revision(state: State<AppState>) -> u32 {
    state.read(api::routing_revision)
}
