//! The commands that refer to trackpoints by their index in the routing buffers, which only mean
//! something for the `revision` they were read with: the commands do nothing if the selection is
//! not the one of that revision anymore.

use gpx_engine::{self as engine, Command};
use tauri::State;

use crate::dto::*;
use crate::state::{edit_at, AppState};

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
    attributes: RouteAttributes,
    anchors: Vec<u32>,
) -> Outcome {
    if lng.len() != lat.len() || lat.len() != ele.len() {
        return Outcome::failed("lng, lat and ele differ in length");
    }
    edit_at!(
        state,
        revision,
        Command::Route(engine::Route {
            start,
            end,
            lng: &lng,
            lat: &lat,
            ele: &ele,
            surface: attributes.surface.view(),
            highway: attributes.highway.view(),
            sac_scale: attributes.sac_scale.view(),
            mtb_scale: attributes.mtb_scale.view(),
            anchors: &anchors,
        })
    )
}

#[tauri::command(async)]
pub fn insert_anchor(state: State<AppState>, revision: u32, lng: f64, lat: f64) -> Outcome {
    edit_at!(
        state,
        revision,
        Command::InsertAnchor(engine::InsertAnchor { lng, lat })
    )
}

#[tauri::command(async)]
pub fn change_loop_start(state: State<AppState>, revision: u32, index: u32) -> Outcome {
    edit_at!(
        state,
        revision,
        Command::ChangeLoopStart(engine::ChangeLoopStart { index })
    )
}

#[tauri::command(async)]
pub fn split(state: State<AppState>, revision: u32, at: u32, split_type: SplitType) -> Outcome {
    edit_at!(
        state,
        revision,
        Command::Split(engine::Split {
            at,
            split_type: split_type.into(),
        })
    )
}
