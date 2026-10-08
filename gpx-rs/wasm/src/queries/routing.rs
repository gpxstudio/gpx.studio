//! The anchors of the routing tool among the trackpoints of the selection.

use gpx_engine as engine;
use js_sys::{Uint8Array, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::session::*;
use crate::ts::*;

// Routing buffers
//
// The anchors of the routing tool among the trackpoints of the selection (the numbering is the one
// of the statistics buffers). The ends of the segments are always anchors.

pub(crate) fn with_routing<T>(f: impl FnOnce(&engine::RoutingBuffer) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow().as_ref().map(|e| f(e.routing())))
}

/// The index in the selection of each anchor.
#[wasm_bindgen]
pub fn anchor_indices() -> Uint32Array {
    with_routing(|r| Uint32Array::from(&r.anchor_indices[..]))
        .unwrap_or_else(|| Uint32Array::new_with_length(0))
}

/// The lowest map zoom level at which each anchor is shown.
#[wasm_bindgen]
pub fn anchor_zooms() -> Uint8Array {
    with_routing(|r| Uint8Array::from(&r.anchor_zooms[..]))
        .unwrap_or_else(|| Uint8Array::new_with_length(0))
}

/// Index in the selection of the first trackpoint of each selected segment that has some.
#[wasm_bindgen]
pub fn segment_starts() -> Uint32Array {
    with_routing(|r| Uint32Array::from(&r.segment_starts[..]))
        .unwrap_or_else(|| Uint32Array::new_with_length(0))
}

/// The id of each selected segment that has trackpoints, as `segment_starts`.
#[wasm_bindgen]
pub fn segment_ids() -> StringList {
    with_routing(|r| array(&r.segment_ids, |id| id.0.to_string().into()))
        .unwrap_or_default()
        .unchecked_into()
}

/// Changes when the selected segments or their trackpoints change: the indices in the selection
/// are only valid while it stays the same.
#[wasm_bindgen]
pub fn routing_revision() -> u32 {
    with_routing(|r| r.revision).unwrap_or_default()
}
