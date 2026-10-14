//! The statistics of the selection and the anchors of the routing tool, as little-endian arrays
//! (one per call, copies of the buffers of the engine). Optional ones start with a byte telling
//! whether they are there.

use tauri::State;

use crate::dto::*;
use crate::state::AppState;

macro_rules! f64_getters {
    ($($name:ident),*) => {$(
        #[tauri::command(async)]
        pub fn $name(state: State<AppState>) -> Bytes {
            Bytes::new(state.read(|e| f64s(&e.statistics().$name)))
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
            optional(state.read(|e| e.statistics().$name.as_deref().map(f64s)))
        }
    )*};
}

optional_f64_getters!(speed, hr, cad, atemp, power);

/// Timestamps in milliseconds since the epoch (`NO_TIME` when missing), as `i64`.
#[tauri::command(async)]
pub fn timestamps(state: State<AppState>) -> Bytes {
    optional(state.read(|e| e.statistics().time.as_deref().map(i64s)))
}

#[tauri::command(async)]
pub fn selection_statistics(state: State<AppState>) -> GlobalStatistics {
    state.read(|e| GlobalStatistics::new(&e.statistics().global))
}

#[tauri::command(async)]
pub fn slice_statistics(
    state: State<AppState>,
    start: usize,
    end: usize,
) -> Option<GlobalStatistics> {
    state.read(move |e| {
        e.statistics()
            .slice(start, end)
            .map(|s| GlobalStatistics::new(&s))
    })
}

macro_rules! intervals_getters {
    ($starts:ident, $values:ident, $field:ident) => {
        #[tauri::command(async)]
        pub fn $starts(state: State<AppState>) -> Bytes {
            Bytes::new(state.read(|e| u32s(&e.statistics().$field.starts)))
        }

        #[tauri::command(async)]
        pub fn $values(state: State<AppState>) -> Bytes {
            Bytes::new(state.read(|e| e.statistics().$field.values.clone()))
        }
    };
}

intervals_getters!(surface_starts, surface_values, surface);
intervals_getters!(highway_starts, highway_values, highway);
intervals_getters!(sac_scale_starts, sac_scale_values, sac_scale);
intervals_getters!(mtb_scale_starts, mtb_scale_values, mtb_scale);

/// The names of the categories, in the order of their codes. The lists only grow.
#[tauri::command(async)]
pub fn surfaces(state: State<AppState>) -> Vec<String> {
    state.read(|e| e.categories().surface.names().to_vec())
}

#[tauri::command(async)]
pub fn highways(state: State<AppState>) -> Vec<String> {
    state.read(|e| e.categories().highway.names().to_vec())
}

#[tauri::command(async)]
pub fn sac_scales(state: State<AppState>) -> Vec<String> {
    state.read(|e| e.categories().sac_scale.names().to_vec())
}

#[tauri::command(async)]
pub fn mtb_scales(state: State<AppState>) -> Vec<String> {
    state.read(|e| e.categories().mtb_scale.names().to_vec())
}

// Routing buffers

#[tauri::command(async)]
pub fn anchor_indices(state: State<AppState>) -> Bytes {
    Bytes::new(state.read(|e| u32s(&e.routing().anchor_indices)))
}

#[tauri::command(async)]
pub fn anchor_zooms(state: State<AppState>) -> Bytes {
    Bytes::new(state.read(|e| e.routing().anchor_zooms.clone()))
}

#[tauri::command(async)]
pub fn segment_starts(state: State<AppState>) -> Bytes {
    Bytes::new(state.read(|e| u32s(&e.routing().segment_starts)))
}

#[tauri::command(async)]
pub fn segment_ids(state: State<AppState>) -> Vec<String> {
    state.read(|e| {
        e.routing()
            .segment_ids
            .iter()
            .map(|id| id.0.to_string())
            .collect()
    })
}

#[tauri::command(async)]
pub fn routing_revision(state: State<AppState>) -> u32 {
    state.read(|e| e.routing().revision)
}
