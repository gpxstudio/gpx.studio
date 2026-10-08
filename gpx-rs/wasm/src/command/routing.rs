//! The commands that refer to trackpoints by their index in the routing buffers.

use gpx_engine::{self as engine, Command};
use js_sys::{Array, Uint8Array, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::ids::*;
use crate::queries::routing::with_routing;
use crate::session::*;
use crate::ts::*;
use crate::types::*;

// Routing
//
// The indices of the trackpoints and of the anchors are the ones of the routing buffers: they only
// mean something for the `revision` they were read with (`routing_revision`), and the commands
// that use them do nothing if the selection is not the one of that revision anymore.

/// Makes the call `f`, unless the selection is not the one of the revision anymore.
pub(crate) fn at_revision(revision: u32, f: impl FnOnce() -> Outcome) -> Outcome {
    if with_routing(|r| r.revision == revision).unwrap_or(false) {
        f()
    } else {
        fail("the selection changed since the routing buffers were read")
    }
}

/// A category of the trackpoints of a route: see `RouteCategory` in `engine`.
pub(crate) struct ParsedCategory {
    starts: Vec<u32>,
    values: Vec<u8>,
    names: Vec<String>,
}

impl ParsedCategory {
    fn parse(attributes: &JsValue, key: &str) -> Option<Self> {
        let Some(category) = property(attributes, key) else {
            return Some(Self {
                starts: vec![],
                values: vec![],
                names: vec![],
            });
        };
        Some(Self {
            starts: property(&category, "starts")?
                .unchecked_into::<Uint32Array>()
                .to_vec(),
            values: property(&category, "values")?
                .unchecked_into::<Uint8Array>()
                .to_vec(),
            names: Array::from(&property(&category, "names")?)
                .iter()
                .map(|name| name.as_string())
                .collect::<Option<_>>()?,
        })
    }

    fn view(&self) -> engine::RouteCategory<'_> {
        engine::RouteCategory {
            starts: &self.starts,
            values: &self.values,
            names: &self.names,
        }
    }
}

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
    let parse = |key| ParsedCategory::parse(&attributes, key);
    let (Some(surface), Some(highway), Some(sac_scale), Some(mtb_scale)) = (
        parse("surface"),
        parse("highway"),
        parse("sacScale"),
        parse("mtbScale"),
    ) else {
        return fail("the attributes of the route are not valid");
    };
    if !same_len(lng, lat, ele) {
        return fail("lng, lat and ele differ in length");
    }
    at_revision(revision, || {
        edit(Command::Route(engine::Route {
            start,
            end,
            lng,
            lat,
            ele,
            surface: surface.view(),
            highway: highway.view(),
            sac_scale: sac_scale.view(),
            mtb_scale: mtb_scale.view(),
            anchors,
        }))
    })
}

/// Makes an anchor of the point of the selected segments that is the closest to the coordinates,
/// inserting a trackpoint on the path if none is there. Does nothing, and says why, if the
/// revision of the routing buffers is not the given one.
#[wasm_bindgen]
pub fn insert_anchor(revision: u32, lng: f64, lat: f64) -> Outcome {
    at_revision(revision, || {
        edit(Command::InsertAnchor(engine::InsertAnchor { lng, lat }))
    })
}

/// Makes the trackpoint `index` of the selection the start of its segment, which is a loop (the
/// trackpoints before it go to the end, and the loop closes on it). Does nothing, and says why, if the revision of the
/// routing buffers is not the given one.
#[wasm_bindgen]
pub fn change_loop_start(revision: u32, index: u32) -> Outcome {
    at_revision(revision, || {
        edit(Command::ChangeLoopStart(engine::ChangeLoopStart { index }))
    })
}

/// Cuts the file, the track or the segment (see `SplitType`) of the trackpoint `at` of the
/// selection in two, there: the trackpoint ends the first part and starts the second one. Does
/// nothing, and returns false, if the revision of the routing buffers is not the given one.
#[wasm_bindgen]
pub fn split(revision: u32, at: u32, split_type: SplitType) -> Outcome {
    at_revision(revision, || {
        edit(Command::Split(engine::Split {
            at,
            split_type: split_type.into(),
        }))
    })
}
