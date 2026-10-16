//! The commands that refer to trackpoints by their index in the routing buffers.

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::ids::*;
use crate::session::*;
use crate::ts::*;
use crate::types::*;

// Routing
//
// The indices of the trackpoints and of the anchors are the ones of the routing buffers: they only
// mean something for the `revision` they were read with (`routing_revision`), and the commands
// that use them do nothing if the selection is not the one of that revision anymore.

/// Replaces the trackpoints `start..end` of the selection by the given ones, in a single segment
/// (see `RoutingBuffer`). A pure insertion if `start == end`, a pure removal without new points.
/// `attributes` holds the surface, highway, SAC scale and MTB scale of the new points, as
/// intervals, and `anchors` the indices among the new points of the ones that become anchors.
/// Does nothing, and says why, if the revision of the routing buffers is not the given one.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn route(
    revision: u32,
    start: u32,
    end: u32,
    lng: &[f64],
    lat: &[f64],
    ele: &[f64],
    attributes: RouteAttributes,
    anchors: &[u32],
) -> Outcome {
    let Some(attributes) = from_js::<api::RouteAttributes>(&attributes) else {
        return fail("the attributes of the route are not valid");
    };
    if !same_len(lng, lat, ele) {
        return fail("lng, lat and ele differ in length");
    }
    run(|e| api::route(e, revision, start, end, lng, lat, ele, &attributes, anchors))
}

/// Makes an anchor of the point of the selected segments that is the closest to the coordinates,
/// inserting a trackpoint on the path if none is there. Does nothing, and says why, if the
/// revision of the routing buffers is not the given one.
#[wasm_bindgen]
pub fn insert_anchor(revision: u32, lng: f64, lat: f64) -> Outcome {
    run(|e| api::insert_anchor(e, revision, lng, lat))
}

/// Makes the trackpoint `index` of the selection the start of its segment, which is a loop (the
/// trackpoints before it go to the end, and the loop closes on it). Does nothing, and says why, if the revision of the
/// routing buffers is not the given one.
#[wasm_bindgen]
pub fn change_loop_start(revision: u32, index: u32) -> Outcome {
    run(|e| api::change_loop_start(e, revision, index))
}

/// Cuts the file, the track or the segment (see `SplitType`) of the trackpoint `at` of the
/// selection in two, there: the trackpoint ends the first part and starts the second one. Does
/// nothing, and returns false, if the revision of the routing buffers is not the given one.
#[wasm_bindgen]
pub fn split(revision: u32, at: u32, split_type: SplitType) -> Outcome {
    run(|e| api::split(e, revision, at, split_type.into(), false))
}
