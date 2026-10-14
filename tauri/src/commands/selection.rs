//! Changing what is selected.

use gpx_engine::{self as engine, Action};
use tauri::State;
use uuid::Uuid;

use crate::dto::*;
use crate::state::{act, AppState};

fn select_elements(
    state: &AppState,
    selection: Option<engine::Selection>,
    mode: SelectMode,
) -> Outcome {
    match selection {
        Some(selection) => act!(
            state,
            Action::Select {
                selection,
                mode: mode.into(),
            }
        ),
        None => Outcome::failed("the ids are not UUIDs"),
    }
}

fn to_file_ids(ids: Vec<Uuid>) -> Vec<engine::FileId> {
    ids.into_iter().map(engine::FileId).collect()
}

#[tauri::command(async)]
pub fn select(state: State<AppState>, file_ids: Vec<Uuid>, mode: SelectMode) -> Outcome {
    let selection = engine::Selection::File {
        file_ids: to_file_ids(file_ids).into_iter().collect(),
    };
    select_elements(&state, Some(selection), mode)
}

#[tauri::command(async)]
pub fn select_all(state: State<AppState>) -> Outcome {
    act!(state, Action::SelectAll)
}

#[tauri::command(async)]
pub fn arrow_select(state: State<AppState>, down: bool, add: bool) -> Outcome {
    act!(state, Action::ArrowSelect { down, add })
}

#[tauri::command(async)]
pub fn select_tracks(
    state: State<AppState>,
    file_id: Uuid,
    track_ids: Vec<Uuid>,
    mode: SelectMode,
) -> Outcome {
    let selection = engine::Selection::Track {
        file_id: engine::FileId(file_id),
        trk_ids: track_ids.into_iter().map(engine::TrackId).collect(),
    };
    select_elements(&state, Some(selection), mode)
}

#[tauri::command(async)]
pub fn select_segments(
    state: State<AppState>,
    file_id: Uuid,
    track_id: Uuid,
    segment_ids: Vec<Uuid>,
    mode: SelectMode,
) -> Outcome {
    let selection = engine::Selection::TrackSegment {
        file_id: engine::FileId(file_id),
        trk_id: engine::TrackId(track_id),
        trkseg_ids: segment_ids
            .into_iter()
            .map(engine::TrackSegmentId)
            .collect(),
    };
    select_elements(&state, Some(selection), mode)
}

#[tauri::command(async)]
pub fn select_waypoint_group(state: State<AppState>, file_id: Uuid, mode: SelectMode) -> Outcome {
    let selection = engine::Selection::Waypoints {
        file_id: engine::FileId(file_id),
    };
    select_elements(&state, Some(selection), mode)
}

#[tauri::command(async)]
pub fn select_waypoints(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_ids: Vec<Uuid>,
    mode: SelectMode,
) -> Outcome {
    let selection = engine::Selection::Waypoint {
        file_id: engine::FileId(file_id),
        wpt_ids: waypoint_ids.into_iter().map(engine::WaypointId).collect(),
    };
    select_elements(&state, Some(selection), mode)
}
