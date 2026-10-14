//! Editing the metadata, the style, the structure and the waypoints of the files, and the tools:
//! reversing, cropping, reducing, timestamps, merging, cleaning...

use gpx_engine::{self as engine, Command, LngLat, LngLatBounds};
use tauri::State;
use uuid::Uuid;

use crate::dto::*;
use crate::state::{act, edit, AppState};

#[tauri::command(async)]
pub fn metadata(state: State<AppState>, name: String, desc: String) -> Outcome {
    edit!(
        state,
        Command::Metadata(engine::Metadata {
            name: &name,
            desc: &desc,
        })
    )
}

#[tauri::command(async)]
pub fn style(
    state: State<AppState>,
    color: Option<String>,
    opacity: Option<f64>,
    width: Option<f64>,
) -> Outcome {
    edit!(
        state,
        Command::Style(engine::Style {
            color: color.as_deref(),
            opacity,
            width,
        })
    )
}

#[tauri::command(async)]
pub fn new_track(state: State<AppState>) -> Outcome {
    edit!(state, Command::NewTrack(engine::NewTrack))
}

#[tauri::command(async)]
pub fn new_track_segment(state: State<AppState>) -> Outcome {
    edit!(state, Command::NewTrackSegment(engine::NewTrackSegment))
}

// Waypoints

#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn new_waypoint(
    state: State<AppState>,
    lng: f64,
    lat: f64,
    ele: f64,
    name: String,
    desc: String,
    icon: String,
    link: String,
) -> Outcome {
    edit!(
        state,
        Command::NewWaypoint(engine::NewWaypoint {
            lng,
            lat,
            ele,
            name: &name,
            desc: &desc,
            icon: &icon,
            link: &link,
        })
    )
}

#[tauri::command(async)]
pub fn move_waypoint(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
) -> Outcome {
    edit!(
        state,
        Command::MoveWaypoint(engine::MoveWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
            lng,
            lat,
            ele,
        })
    )
}

#[tauri::command(async)]
pub fn delete_waypoint(state: State<AppState>, file_id: Uuid, waypoint_id: Uuid) -> Outcome {
    edit!(
        state,
        Command::DeleteWaypoint(engine::DeleteWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
        })
    )
}

#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn update_waypoint(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
    name: String,
    desc: String,
    icon: String,
    link: String,
) -> Outcome {
    edit!(
        state,
        Command::EditWaypoint(engine::EditWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
            lng,
            lat,
            ele,
            name: &name,
            desc: &desc,
            icon: &icon,
            link: &link,
        })
    )
}

// Tools

#[tauri::command(async)]
pub fn reverse(state: State<AppState>) -> Outcome {
    edit!(state, Command::Reverse(engine::Reverse))
}

#[tauri::command(async)]
pub fn round_trip(state: State<AppState>) -> Outcome {
    edit!(state, Command::RoundTrip(engine::RoundTrip))
}

#[tauri::command(async)]
pub fn crop(state: State<AppState>, start: u32, end: u32) -> Outcome {
    if start > end {
        return Outcome::failed(format!("the range {start}..{end} is reversed"));
    }
    edit!(state, Command::Crop(engine::Crop { start, end }))
}

#[tauri::command(async)]
pub fn reduce(state: State<AppState>, tolerance: f64) -> Outcome {
    edit!(state, Command::Reduce(engine::Reduce { tolerance }))
}

#[tauri::command(async)]
pub fn change_timestamps(
    state: State<AppState>,
    start_time: f64,
    speed: f64,
    ratio: f64,
) -> Outcome {
    edit!(
        state,
        Command::Time(engine::Time {
            start_time: start_time as i64,
            kind: engine::TimeKind::Change { speed, ratio },
        })
    )
}

#[tauri::command(async)]
pub fn create_artificial_timestamps(
    state: State<AppState>,
    start_time: f64,
    total_time: f64,
) -> Outcome {
    edit!(
        state,
        Command::Time(engine::Time {
            start_time: start_time as i64,
            kind: engine::TimeKind::Artificial { total_time },
        })
    )
}

#[tauri::command(async)]
pub fn merge(state: State<AppState>, merge_type: MergeType, remove_gaps: bool) -> Outcome {
    edit!(
        state,
        Command::Merge(engine::Merge {
            type_: merge_type.into(),
            remove_gaps,
        })
    )
}

#[tauri::command(async)]
pub fn extract(state: State<AppState>) -> Outcome {
    edit!(state, Command::Extract(engine::Extract))
}

#[tauri::command(async)]
pub fn elevation(state: State<AppState>, ele: Vec<f64>) -> Outcome {
    edit!(state, Command::Elevation(engine::Elevation { ele: &ele }))
}

#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn clean(
    state: State<AppState>,
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    clean_type: CleanType,
    trkpt: bool,
    wpt: bool,
) -> Outcome {
    edit!(
        state,
        Command::Clean(engine::Clean {
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
            type_: clean_type.into(),
            trkpt,
            wpt,
        })
    )
}
