//! Changing what is selected.

use gpx_engine::{self as engine, Action};
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

use crate::ids::*;
use crate::session::*;
use crate::types::SelectMode;

// Selection

/// Selects files. `file_ids_bytes`: concatenated 16-byte UUIDs. Unknown files are ignored, and
/// selecting nothing deselects everything. See `SelectMode`.
#[wasm_bindgen]
pub fn select(file_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    select_elements(
        file_ids(file_ids_bytes).map(|ids| engine::Selection::File {
            file_ids: ids.into_iter().collect(),
        }),
        mode,
    )
}

/// Selects all the elements of the same kind as the selected ones, in the same place: all the
/// files, the tracks of the file, the segments of the track, the waypoints of the file. All the
/// files when nothing is selected.
#[wasm_bindgen]
pub fn select_all() -> Outcome {
    execute(Action::SelectAll)
}

/// Moves the selection to the next (`down`) or previous element of the same kind, like the arrow
/// keys do in the file list. With `add` (shift + arrow), the element is added to the selection,
/// otherwise it replaces it.
#[wasm_bindgen]
pub fn arrow_select(down: bool, add: bool) -> Outcome {
    execute(Action::ArrowSelect { down, add })
}

// The elements below cross as the id of their file (UUID string) and, like the files, as
// concatenated 16-byte UUIDs. What does not exist is ignored. See `SelectMode`: elements are merged
// with the selection when it holds elements of the same kind in the same place (same file, same
// track for segments), otherwise they replace it.

pub(crate) fn select_elements(selection: Option<engine::Selection>, mode: SelectMode) -> Outcome {
    match selection {
        Some(selection) => execute(Action::Select {
            selection,
            mode: mode.into(),
        }),
        None => fail("the ids are not UUIDs"),
    }
}

#[wasm_bindgen]
pub fn select_tracks(file_id: &str, track_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid_list(track_ids_bytes))
            .map(|(file_id, ids)| engine::Selection::Track {
                file_id,
                trk_ids: ids.into_iter().map(engine::TrackId).collect(),
            }),
        mode,
    )
}

#[wasm_bindgen]
pub fn select_segments(
    file_id: &str,
    track_id: &str,
    segment_ids_bytes: &[u8],
    mode: SelectMode,
) -> Outcome {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid::Uuid::parse_str(track_id).ok())
            .zip(uuid_list(segment_ids_bytes))
            .map(|((file_id, trk_id), ids)| engine::Selection::TrackSegment {
                file_id,
                trk_id: engine::TrackId(trk_id),
                trkseg_ids: ids.into_iter().map(engine::TrackSegmentId).collect(),
            }),
        mode,
    )
}

/// Selects the node standing for all the waypoints of a file.
#[wasm_bindgen]
pub fn select_waypoint_group(file_id: &str, mode: SelectMode) -> Outcome {
    select_elements(
        parse_file_id(file_id).map(|file_id| engine::Selection::Waypoints { file_id }),
        mode,
    )
}

#[wasm_bindgen]
pub fn select_waypoints(file_id: &str, waypoint_ids_bytes: &[u8], mode: SelectMode) -> Outcome {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid_list(waypoint_ids_bytes))
            .map(|(file_id, ids)| engine::Selection::Waypoint {
                file_id,
                wpt_ids: ids.into_iter().map(engine::WaypointId).collect(),
            }),
        mode,
    )
}
