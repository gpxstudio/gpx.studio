//! The files, their structure and statistics, the selection and the clipboard.

// File order and structures
//
// The files are described by one ordered list of ids and one structure object per file, so that
// the UI can react to what changed only: after each action, the outcome tells which structures to
// (re)read or drop and whether the order changed. Ids are UUID strings. The trackpoints of a
// segment and the waypoints of a file are in the same order as the coordinates of their buffers
// (see below).

use gpx_engine::{ExportOptions, api};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::ids::*;
use crate::session::*;
use crate::ts::*;

/// Ids of the files in display order.
#[wasm_bindgen]
pub fn file_order() -> FileOrder {
    to_js(&with_engine(api::file_order).unwrap_or_default()).unchecked_into()
}

/// Structure of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_structure(file_id: &str) -> FileStructure {
    let structure =
        parse_uuid(file_id).and_then(|id| with_engine(|e| api::file_structure(e, id)).flatten());
    optional_js(structure).unchecked_into()
}

/// Global statistics of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_statistics(file_id: &str) -> GlobalStatistics {
    let statistics =
        parse_uuid(file_id).and_then(|id| with_engine(|e| api::file_statistics(e, id)).flatten());
    optional_js(statistics).unchecked_into()
}

/// Global statistics of the whole selection (the arrays of the statistics buffers cover it).
#[wasm_bindgen]
pub fn selection_statistics() -> GlobalStatistics {
    optional_js(with_engine(api::selection_statistics)).unchecked_into()
}

/// A file as GPX (UTF-8 bytes), `undefined` if it does not exist. The options say which data of the trackpoints
/// to keep.
#[wasm_bindgen]
pub fn export_file(
    file_id: &str,
    time: bool,
    hr: bool,
    cad: bool,
    atemp: bool,
    power: bool,
    osm: bool,
) -> Option<Vec<u8>> {
    let id = parse_uuid(file_id)?;
    let options = ExportOptions {
        time,
        hr,
        cad,
        atemp,
        power,
        osm,
    };
    with_engine(|e| api::export_file(e, id, options)).flatten()
}

/// The data that some files have, so that the ones that none has are not offered when exporting
/// them: a bit for the time (1), heart rate (2), cadence (4), temperature (8), power (16) and the
/// OpenStreetMap data (32). `file_ids` are concatenated UUIDs.
#[wasm_bindgen]
pub fn exportable_data(file_ids: &[u8]) -> u8 {
    let Some(ids) = uuid_list(file_ids) else {
        return 0;
    };
    with_engine(|e| api::exportable_data(e, &ids)).unwrap_or(0)
}

/// Global statistics of the trackpoints from `start` to `end` (both included) of the selection,
/// as indexed by the statistics buffers. `undefined` when the range is not in the selection.
#[wasm_bindgen]
pub fn slice_statistics(start: usize, end: usize) -> GlobalStatistics {
    optional_js(with_engine(|e| api::slice_statistics(e, start, end)).flatten()).unchecked_into()
}

/// The current selection (ids are UUID strings).
#[wasm_bindgen]
pub fn selection() -> Selection {
    to_js(&with_engine(api::selection).unwrap_or(api::Selection::Empty)).unchecked_into()
}

/// All the data of a waypoint of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn waypoint(file_id: &str, waypoint_id: &str) -> WaypointDetails {
    let details = parse_uuid(file_id)
        .zip(parse_uuid(waypoint_id))
        .and_then(|(file_id, id)| with_engine(|e| api::waypoint(e, file_id, id)).flatten());
    optional_js(details).unchecked_into()
}

/// A trackpoint of a segment of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn trackpoint(file_id: &str, segment_id: &str, index: usize) -> TrackpointDetails {
    let details =
        parse_uuid(file_id)
            .zip(parse_uuid(segment_id))
            .and_then(|(file_id, segment_id)| {
                with_engine(|e| api::trackpoint(e, file_id, segment_id, index)).flatten()
            });
    optional_js(details).unchecked_into()
}

/// What was copied or cut and is waiting to be pasted, `undefined` if nothing: the kind of the
/// elements and their ids (UUID strings).
#[wasm_bindgen]
pub fn clipboard() -> Clipboard {
    optional_js(with_engine(api::clipboard).flatten()).unchecked_into()
}
