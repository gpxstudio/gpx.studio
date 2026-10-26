//! The files, their structure and statistics, the selection, the clipboard, and the coordinates of
//! the trackpoints and waypoints (flat `[lng, lat, ...]` little-endian `f64` arrays).

use gpx_engine::{ExportOptions, api};
use tauri::State;
use uuid::Uuid;

use crate::bytes::*;
use crate::state::AppState;

#[tauri::command(async)]
pub fn file_order(state: State<AppState>) -> Vec<String> {
    state.read(api::file_order)
}

#[tauri::command(async)]
pub fn file_structure(state: State<AppState>, file_id: Uuid) -> Option<api::FileStructure> {
    state.read(move |e| api::file_structure(e, file_id))
}

#[tauri::command(async)]
pub fn file_statistics(state: State<AppState>, file_id: Uuid) -> Option<api::GlobalStatistics> {
    state.read(move |e| api::file_statistics(e, file_id))
}

#[tauri::command(async)]
pub fn selection(state: State<AppState>) -> api::Selection {
    state.read(api::selection)
}

#[tauri::command(async)]
pub fn clipboard(state: State<AppState>) -> Option<api::Clipboard> {
    state.read(api::clipboard)
}

#[tauri::command(async)]
pub fn can_undo(state: State<AppState>) -> bool {
    state.read(api::can_undo)
}

#[tauri::command(async)]
pub fn can_redo(state: State<AppState>) -> bool {
    state.read(api::can_redo)
}

#[tauri::command(async)]
pub fn can_paste(state: State<AppState>) -> bool {
    state.read(api::can_paste)
}

#[tauri::command(async)]
pub fn waypoint(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_id: Uuid,
) -> Option<api::WaypointDetails> {
    state.read(move |e| api::waypoint(e, file_id, waypoint_id))
}

#[tauri::command(async)]
pub fn trackpoint(
    state: State<AppState>,
    file_id: Uuid,
    segment_id: Uuid,
    index: usize,
) -> Option<api::TrackpointDetails> {
    state.read(move |e| api::trackpoint(e, file_id, segment_id, index))
}

/// A file as GPX (UTF-8 bytes), the first byte telling whether the file exists.
#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn export_file(
    state: State<AppState>,
    file_id: Uuid,
    time: bool,
    hr: bool,
    cad: bool,
    atemp: bool,
    power: bool,
    osm: bool,
) -> Bytes {
    let options = ExportOptions {
        time,
        hr,
        cad,
        atemp,
        power,
        osm,
    };
    optional(state.read(move |e| api::export_file(e, file_id, options)))
}

#[tauri::command(async)]
pub fn exportable_data(state: State<AppState>, file_ids: Vec<Uuid>) -> u8 {
    state.read(move |e| api::exportable_data(e, &file_ids))
}

#[tauri::command(async)]
pub fn reduction_distances(state: State<AppState>) -> Bytes {
    f64s(&state.read(api::reduction_distances))
}

#[tauri::command(async)]
pub fn segment_coordinates(state: State<AppState>, segment_id: Uuid) -> Bytes {
    f64s(&state.read(move |e| api::segment_coordinates(e, segment_id).to_vec()))
}

#[tauri::command(async)]
pub fn waypoint_coordinates(state: State<AppState>, file_id: Uuid) -> Bytes {
    f64s(&state.read(move |e| api::waypoint_coordinates(e, file_id).to_vec()))
}
