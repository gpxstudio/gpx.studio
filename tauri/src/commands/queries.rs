//! The files, their structure and statistics, the selection, the clipboard, and the coordinates of
//! the trackpoints and waypoints (flat `[lng, lat, ...]` little-endian `f64` arrays).

use gpx_engine::{self as engine, FileId};
use tauri::State;
use uuid::Uuid;

use crate::dto::*;
use crate::state::AppState;

#[tauri::command(async)]
pub fn file_order(state: State<AppState>) -> Vec<String> {
    state.read(|e| ids(e.order()))
}

#[tauri::command(async)]
pub fn file_structure(state: State<AppState>, file_id: Uuid) -> Option<FileStructure> {
    state.read(move |e| e.file_structure(&FileId(file_id)).map(FileStructure::new))
}

#[tauri::command(async)]
pub fn file_statistics(state: State<AppState>, file_id: Uuid) -> Option<GlobalStatistics> {
    state.read(move |e| {
        e.file_statistics(&FileId(file_id))
            .map(|s| GlobalStatistics::new(&s))
    })
}

#[tauri::command(async)]
pub fn selection(state: State<AppState>) -> Selection {
    state.read(|e| e.selection().into())
}

#[tauri::command(async)]
pub fn clipboard(state: State<AppState>) -> Option<Clipboard> {
    state.read(|e| e.clipboard().map(Clipboard::new))
}

#[tauri::command(async)]
pub fn can_undo(state: State<AppState>) -> bool {
    state.read(|e| e.can_undo())
}

#[tauri::command(async)]
pub fn can_redo(state: State<AppState>) -> bool {
    state.read(|e| e.can_redo())
}

#[tauri::command(async)]
pub fn can_paste(state: State<AppState>) -> bool {
    state.read(|e| e.can_paste())
}

#[tauri::command(async)]
pub fn waypoint(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_id: Uuid,
) -> Option<WaypointDetails> {
    state.read(move |e| {
        e.waypoint(&FileId(file_id), &engine::WaypointId(waypoint_id))
            .map(WaypointDetails::new)
    })
}

#[tauri::command(async)]
pub fn trackpoint(
    state: State<AppState>,
    file_id: Uuid,
    segment_id: Uuid,
    index: usize,
) -> Option<TrackpointDetails> {
    state.read(move |e| {
        e.trackpoint(&FileId(file_id), &engine::TrackSegmentId(segment_id), index)
            .map(TrackpointDetails::new)
    })
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
    as_route: bool,
) -> Bytes {
    let options = engine::ExportOptions {
        time,
        hr,
        cad,
        atemp,
        power,
        osm,
        as_route,
    };
    optional(state.read(move |e| e.export(&FileId(file_id), options)))
}

/// The data that some files have: a bit for the time (1), heart rate (2), cadence (4), temperature
/// (8), power (16) and the OpenStreetMap data (32).
#[tauri::command(async)]
pub fn exportable_data(state: State<AppState>, file_ids: Vec<Uuid>) -> u8 {
    state.read(move |e| {
        let ids: Vec<FileId> = file_ids.into_iter().map(FileId).collect();
        let data = e.exportable_data(&ids);
        [
            data.time, data.hr, data.cad, data.atemp, data.power, data.osm,
        ]
        .iter()
        .enumerate()
        .fold(0, |bits, (i, on)| bits | (u8::from(*on) << i))
    })
}

#[tauri::command(async)]
pub fn reduction_distances(state: State<AppState>) -> Bytes {
    Bytes::new(state.read(|e| f64s(&e.reduction_distances())))
}

#[tauri::command(async)]
pub fn segment_coordinates(state: State<AppState>, segment_id: Uuid) -> Bytes {
    Bytes::new(
        state.read(move |e| f64s(e.segment_coordinates(&engine::TrackSegmentId(segment_id)))),
    )
}

#[tauri::command(async)]
pub fn waypoint_coordinates(state: State<AppState>, file_id: Uuid) -> Bytes {
    Bytes::new(state.read(move |e| f64s(e.waypoint_coordinates(&FileId(file_id)))))
}
