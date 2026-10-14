//! Changing what is selected.

use gpx_engine::{SelectMode, api};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

#[tauri::command(async)]
pub fn select(state: State<AppState>, file_ids: Vec<Uuid>, mode: SelectMode) -> api::Outcome {
    state.run(move |e| api::select(e, &file_ids, mode))
}

#[tauri::command(async)]
pub fn select_all(state: State<AppState>) -> api::Outcome {
    state.run(api::select_all)
}

#[tauri::command(async)]
pub fn arrow_select(state: State<AppState>, down: bool, add: bool) -> api::Outcome {
    state.run(move |e| api::arrow_select(e, down, add))
}

#[tauri::command(async)]
pub fn select_tracks(
    state: State<AppState>,
    file_id: Uuid,
    track_ids: Vec<Uuid>,
    mode: SelectMode,
) -> api::Outcome {
    state.run(move |e| api::select_tracks(e, file_id, &track_ids, mode))
}

#[tauri::command(async)]
pub fn select_segments(
    state: State<AppState>,
    file_id: Uuid,
    track_id: Uuid,
    segment_ids: Vec<Uuid>,
    mode: SelectMode,
) -> api::Outcome {
    state.run(move |e| api::select_segments(e, file_id, track_id, &segment_ids, mode))
}

#[tauri::command(async)]
pub fn select_waypoint_group(
    state: State<AppState>,
    file_id: Uuid,
    mode: SelectMode,
) -> api::Outcome {
    state.run(move |e| api::select_waypoint_group(e, file_id, mode))
}

#[tauri::command(async)]
pub fn select_waypoints(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_ids: Vec<Uuid>,
    mode: SelectMode,
) -> api::Outcome {
    state.run(move |e| api::select_waypoints(e, file_id, &waypoint_ids, mode))
}
