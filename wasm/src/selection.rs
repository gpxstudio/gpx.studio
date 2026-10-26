//! Changing what is selected.

use gpx_engine::api;
use wasm_bindgen::prelude::*;

use crate::ids::*;
use crate::session::*;
use crate::ts::Outcome;
use crate::types::SelectMode;

// Selection

/// Selects files. `file_ids_bytes`: concatenated 16-byte UUIDs. Unknown files are ignored, and
/// selecting nothing deselects everything. See `SelectMode`.
#[wasm_bindgen]
pub fn select(file_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    match uuid_list(file_ids_bytes) {
        Some(ids) => run(|e| api::select(e, &ids, mode.into())),
        None => fail("the ids are not UUIDs"),
    }
}

/// Selects all the elements of the same kind as the selected ones, in the same place: all the
/// files, the tracks of the file, the segments of the track, the waypoints of the file. All the
/// files when nothing is selected.
#[wasm_bindgen]
pub fn select_all() -> Outcome {
    run(api::select_all)
}

/// Moves the selection to the next (`down`) or previous element of the same kind, like the arrow
/// keys do in the file list. With `add` (shift + arrow), the element is added to the selection,
/// otherwise it replaces it.
#[wasm_bindgen]
pub fn arrow_select(down: bool, add: bool) -> Outcome {
    run(|e| api::arrow_select(e, down, add))
}

// The elements below cross as the id of their file (UUID string) and, like the files, as
// concatenated 16-byte UUIDs. What does not exist is ignored. See `SelectMode`: elements are merged
// with the selection when it holds elements of the same kind in the same place (same file, same
// track for segments), otherwise they replace it.

#[wasm_bindgen]
pub fn select_routes(file_id: &str, route_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    match parse_uuid(file_id).zip(uuid_list(route_ids_bytes)) {
        Some((file_id, ids)) => run(|e| api::select_routes(e, file_id, &ids, mode.into())),
        None => fail("the ids are not UUIDs"),
    }
}

#[wasm_bindgen]
pub fn select_tracks(file_id: &str, track_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    match parse_uuid(file_id).zip(uuid_list(track_ids_bytes)) {
        Some((file_id, ids)) => run(|e| api::select_tracks(e, file_id, &ids, mode.into())),
        None => fail("the ids are not UUIDs"),
    }
}

#[wasm_bindgen]
pub fn select_segments(
    file_id: &str,
    track_id: &str,
    segment_ids_bytes: &[u8],
    mode: SelectMode,
) -> Outcome {
    match parse_uuid(file_id)
        .zip(parse_uuid(track_id))
        .zip(uuid_list(segment_ids_bytes))
    {
        Some(((file_id, track_id), ids)) => {
            run(|e| api::select_segments(e, file_id, track_id, &ids, mode.into()))
        }
        None => fail("the ids are not UUIDs"),
    }
}

/// Selects the node standing for all the waypoints of a file.
#[wasm_bindgen]
pub fn select_waypoint_group(file_id: &str, mode: SelectMode) -> Outcome {
    match parse_uuid(file_id) {
        Some(file_id) => run(|e| api::select_waypoint_group(e, file_id, mode.into())),
        None => fail("the ids are not UUIDs"),
    }
}

#[wasm_bindgen]
pub fn select_waypoints(file_id: &str, waypoint_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    match parse_uuid(file_id).zip(uuid_list(waypoint_ids_bytes)) {
        Some((file_id, ids)) => run(|e| api::select_waypoints(e, file_id, &ids, mode.into())),
        None => fail("the ids are not UUIDs"),
    }
}
