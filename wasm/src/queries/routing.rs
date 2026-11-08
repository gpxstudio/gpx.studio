//! The anchors of the routing tool among the trackpoints of the selection.

use gpx_engine::api;
use js_sys::{Uint8Array, Uint32Array};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::session::*;
use crate::ts::*;

// Routing buffers
//
// The anchors of the routing tool among the trackpoints of the selection (the numbering is the one
// of the statistics buffers). The ends of the segments are always anchors.

/// The index in the selection of each anchor.
#[wasm_bindgen]
pub fn anchor_indices() -> Uint32Array {
    with_engine(|e| Uint32Array::from(api::anchor_indices(e)))
        .unwrap_or_else(|| Uint32Array::new_with_length(0))
}

/// The lowest map zoom level at which each anchor is shown.
#[wasm_bindgen]
pub fn anchor_zooms() -> Uint8Array {
    with_engine(|e| Uint8Array::from(api::anchor_zooms(e)))
        .unwrap_or_else(|| Uint8Array::new_with_length(0))
}

/// Index in the selection of the first trackpoint of each selected segment that has some.
#[wasm_bindgen]
pub fn segment_starts() -> Uint32Array {
    with_engine(|e| Uint32Array::from(api::segment_starts(e)))
        .unwrap_or_else(|| Uint32Array::new_with_length(0))
}

/// The id of each selected segment that has trackpoints, as `segment_starts`.
#[wasm_bindgen]
pub fn segment_ids() -> StringList {
    to_js(&with_engine(api::segment_ids).unwrap_or_default()).unchecked_into()
}

/// Changes when the selected segments or their trackpoints change: the indices in the selection
/// are only valid while it stays the same.
#[wasm_bindgen]
pub fn routing_revision() -> u32 {
    with_engine(api::routing_revision).unwrap_or_default()
}
