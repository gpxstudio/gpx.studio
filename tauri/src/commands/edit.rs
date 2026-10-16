//! Editing the metadata, the style, the structure and the waypoints of the files, and the tools:
//! reversing, cropping, reducing, timestamps, merging, cleaning...

use gpx_engine::{CleanType, MergeType, SplitType, api};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

#[tauri::command(async)]
pub fn metadata(state: State<AppState>, name: String, desc: String) -> api::Outcome {
    state.run(move |e| api::metadata(e, &name, &desc))
}

#[tauri::command(async)]
pub fn style(
    state: State<AppState>,
    color: Option<String>,
    opacity: Option<f64>,
    width: Option<f64>,
) -> api::Outcome {
    state.run(move |e| api::style(e, color.as_deref(), opacity, width))
}

#[tauri::command(async)]
pub fn new_track(state: State<AppState>) -> api::Outcome {
    state.run(api::new_track)
}

#[tauri::command(async)]
pub fn new_track_segment(state: State<AppState>) -> api::Outcome {
    state.run(api::new_track_segment)
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
) -> api::Outcome {
    state.run(move |e| api::new_waypoint(e, lng, lat, ele, &name, &desc, &icon, &link))
}

#[tauri::command(async)]
pub fn move_waypoint(
    state: State<AppState>,
    file_id: Uuid,
    waypoint_id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
) -> api::Outcome {
    state.run(move |e| api::move_waypoint(e, file_id, waypoint_id, lng, lat, ele))
}

#[tauri::command(async)]
pub fn delete_waypoint(state: State<AppState>, file_id: Uuid, waypoint_id: Uuid) -> api::Outcome {
    state.run(move |e| api::delete_waypoint(e, file_id, waypoint_id))
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
) -> api::Outcome {
    state.run(move |e| {
        api::update_waypoint(
            e,
            file_id,
            waypoint_id,
            lng,
            lat,
            ele,
            &name,
            &desc,
            &icon,
            &link,
        )
    })
}

// Tools

#[tauri::command(async)]
pub fn reverse(state: State<AppState>) -> api::Outcome {
    state.run(api::reverse)
}

#[tauri::command(async)]
pub fn round_trip(state: State<AppState>) -> api::Outcome {
    state.run(api::round_trip)
}

#[tauri::command(async)]
pub fn crop(state: State<AppState>, start: u32, end: u32) -> api::Outcome {
    state.run(move |e| api::crop(e, start, end))
}

#[tauri::command(async)]
pub fn reduce(state: State<AppState>, tolerance: f64) -> api::Outcome {
    state.run(move |e| api::reduce(e, tolerance))
}

#[tauri::command(async)]
pub fn change_timestamps(
    state: State<AppState>,
    start_time: f64,
    speed: f64,
    ratio: f64,
) -> api::Outcome {
    state.run(move |e| api::change_timestamps(e, start_time, speed, ratio))
}

#[tauri::command(async)]
pub fn create_artificial_timestamps(
    state: State<AppState>,
    start_time: f64,
    total_time: f64,
) -> api::Outcome {
    state.run(move |e| api::create_artificial_timestamps(e, start_time, total_time))
}

#[tauri::command(async)]
pub fn merge(state: State<AppState>, merge_type: MergeType, remove_gaps: bool) -> api::Outcome {
    state.core(move |core| core.creating(None, false, |e| api::merge(e, merge_type, remove_gaps)))
}

#[tauri::command(async)]
pub fn extract(state: State<AppState>) -> api::Outcome {
    state.core(|core| core.creating(None, false, api::extract))
}

#[tauri::command(async)]
pub fn elevation(state: State<AppState>, ele: Vec<f64>) -> api::Outcome {
    state.run(move |e| api::elevation(e, &ele))
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
) -> api::Outcome {
    state.run(move |e| api::clean(e, west, south, east, north, clean_type, trkpt, wpt))
}

// Routing

#[tauri::command(async)]
#[allow(clippy::too_many_arguments)]
pub fn route(
    state: State<AppState>,
    revision: u32,
    start: u32,
    end: u32,
    lng: Vec<f64>,
    lat: Vec<f64>,
    ele: Vec<f64>,
    attributes: api::RouteAttributes,
    anchors: Vec<u32>,
) -> api::Outcome {
    state.run(move |e| {
        api::route(
            e,
            revision,
            start,
            end,
            &lng,
            &lat,
            &ele,
            &attributes,
            &anchors,
        )
    })
}

#[tauri::command(async)]
pub fn insert_anchor(state: State<AppState>, revision: u32, lng: f64, lat: f64) -> api::Outcome {
    state.run(move |e| api::insert_anchor(e, revision, lng, lat))
}

#[tauri::command(async)]
pub fn change_loop_start(state: State<AppState>, revision: u32, index: u32) -> api::Outcome {
    state.run(move |e| api::change_loop_start(e, revision, index))
}

#[tauri::command(async)]
pub fn split(
    state: State<AppState>,
    revision: u32,
    at: u32,
    split_type: SplitType,
) -> api::Outcome {
    state.core(move |core| core.creating(None, false, |e| api::split(e, revision, at, split_type)))
}
