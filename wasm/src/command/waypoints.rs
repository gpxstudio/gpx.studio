//! Creating, editing, moving and deleting waypoints.

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::ids::*;
use crate::session::*;

#[wasm_bindgen]
pub fn new_waypoint(
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> Outcome {
    run(|e| api::new_waypoint(e, lng, lat, ele, name, desc, icon, link))
}

/// Moves a waypoint of a file, whatever is selected.
#[wasm_bindgen]
pub fn move_waypoint(file_id: &str, waypoint_id: &str, lng: f64, lat: f64, ele: f64) -> Outcome {
    match parse_uuid(file_id).zip(parse_uuid(waypoint_id)) {
        Some((file_id, waypoint_id)) => {
            run(|e| api::move_waypoint(e, file_id, waypoint_id, lng, lat, ele))
        }
        None => fail("the file or waypoint id is not a UUID"),
    }
}

/// Deletes a waypoint of a file, whatever is selected.
#[wasm_bindgen]
pub fn delete_waypoint(file_id: &str, waypoint_id: &str) -> Outcome {
    match parse_uuid(file_id).zip(parse_uuid(waypoint_id)) {
        Some((file_id, waypoint_id)) => run(|e| api::delete_waypoint(e, file_id, waypoint_id)),
        None => fail("the file or waypoint id is not a UUID"),
    }
}

/// Changes a waypoint of a file, whatever is selected: its name, description, icon, link, position
/// and elevation. The strings that are empty remove the field.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn update_waypoint(
    file_id: &str,
    waypoint_id: &str,
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> Outcome {
    match parse_uuid(file_id).zip(parse_uuid(waypoint_id)) {
        Some((file_id, waypoint_id)) => run(|e| {
            api::update_waypoint(
                e,
                file_id,
                waypoint_id,
                lng,
                lat,
                ele,
                name,
                desc,
                icon,
                link,
            )
        }),
        None => fail("the file or waypoint id is not a UUID"),
    }
}
