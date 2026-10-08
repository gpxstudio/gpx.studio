//! The files, their structure and statistics, the selection and the clipboard.

// File order and structures
//
// The files are described by one ordered list of ids and one structure object per file, so that
// the UI can react to what changed only: after each action, `last_update` tells which
// structures to (re)read or drop and whether the order changed. Ids are UUID strings. The
// trackpoints of a segment and the waypoints of a file are in the same order as the coordinates
// of their buffers (see below).

use gpx_engine::{self as engine, FileId};
use js_sys::Object;
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::ids::*;
use crate::queries::statistics::with_stats;
use crate::session::*;
use crate::ts::*;

/// Ids of the files in display order.
#[wasm_bindgen]
pub fn file_order() -> FileOrder {
    let order = with_engine(|e| ids(e.order())).unwrap_or_default();
    order.unchecked_into()
}

/// Structure of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_structure(file_id: &str) -> FileStructure {
    let structure = uuid::Uuid::parse_str(file_id)
        .ok()
        .and_then(|id| {
            with_engine(|e| e.file_structure(&FileId(id)).map(structure_object)).flatten()
        })
        .map_or(JsValue::UNDEFINED, JsValue::from);
    structure.unchecked_into()
}

/// Global statistics of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_statistics(file_id: &str) -> GlobalStatistics {
    uuid::Uuid::parse_str(file_id)
        .ok()
        .and_then(|id| with_engine(|e| e.file_statistics(&FileId(id))).flatten())
        .map_or(JsValue::UNDEFINED.unchecked_into(), |stats| {
            statistics_object(&stats)
        })
}

/// Global statistics of the whole selection (the arrays of the statistics buffers cover it).
#[wasm_bindgen]
pub fn selection_statistics() -> GlobalStatistics {
    with_stats(|buffer| statistics_object(&buffer.global))
        .unwrap_or_else(|| JsValue::UNDEFINED.unchecked_into())
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
    let id = parse_file_id(file_id)?;
    let options = engine::ExportOptions {
        time,
        hr,
        cad,
        atemp,
        power,
        osm,
    };
    with_engine(|e| e.export(&id, options)).flatten()
}

/// The data that some files have, so that the ones that none has are not offered when exporting
/// them: a bit for the time (1), heart rate (2), cadence (4), temperature (8), power (16) and the
/// OpenStreetMap data (32). `file_ids` are concatenated UUIDs.
#[wasm_bindgen]
pub fn exportable_data(file_ids: &[u8]) -> u8 {
    let Some(ids) = self::file_ids(file_ids) else {
        return 0;
    };
    let data = with_engine(|e| e.exportable_data(&ids)).unwrap_or(engine::ExportOptions::NONE);
    [
        data.time, data.hr, data.cad, data.atemp, data.power, data.osm,
    ]
    .iter()
    .enumerate()
    .fold(0, |bits, (i, on)| bits | (u8::from(*on) << i))
}

/// Global statistics of the trackpoints from `start` to `end` (both included) of the selection,
/// as indexed by the statistics buffers. `undefined` when the range is not in the selection.
#[wasm_bindgen]
pub fn slice_statistics(start: usize, end: usize) -> GlobalStatistics {
    with_stats(|buffer| buffer.slice(start, end))
        .flatten()
        .map_or(JsValue::UNDEFINED.unchecked_into(), |stats| {
            statistics_object(&stats)
        })
}

/// The current selection (ids are UUID strings).
#[wasm_bindgen]
pub fn selection() -> Selection {
    with_engine(|e| selection_object(e.selection()))
        .unwrap_or_default()
        .unchecked_into()
}

/// All the data of a waypoint of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn waypoint(file_id: &str, waypoint_id: &str) -> WaypointDetails {
    uuid::Uuid::parse_str(file_id)
        .ok()
        .zip(uuid::Uuid::parse_str(waypoint_id).ok())
        .and_then(|(file_id, id)| {
            with_engine(|e| {
                e.waypoint(&FileId(file_id), &engine::WaypointId(id))
                    .map(|wpt| {
                        let object = Object::new();
                        set(&object, "id", wpt.id.0.to_string());
                        set(&object, "lng", wpt.coordinates.lng);
                        set(&object, "lat", wpt.coordinates.lat);
                        set(&object, "ele", wpt.ele);
                        if let Some(time) = wpt.time {
                            set(&object, "time", time as f64);
                        }
                        for (key, value) in [
                            ("name", &wpt.name),
                            ("desc", &wpt.desc),
                            ("cmt", &wpt.cmt),
                            ("sym", &wpt.sym),
                        ] {
                            if let Some(value) = value {
                                set(&object, key, value.as_str());
                            }
                        }
                        if let Some(link) = &wpt.link {
                            let link_object = Object::new();
                            set(&link_object, "href", link.href.as_str());
                            if let Some(text) = &link.text {
                                set(&link_object, "text", text.as_str());
                            }
                            set(&object, "link", link_object);
                        }
                        JsValue::from(object)
                    })
            })
            .flatten()
        })
        .unwrap_or(JsValue::UNDEFINED)
        .unchecked_into()
}

/// A trackpoint of a segment of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn trackpoint(file_id: &str, segment_id: &str, index: usize) -> TrackpointDetails {
    parse_file_id(file_id)
        .zip(uuid::Uuid::parse_str(segment_id).ok())
        .and_then(|(file_id, segment_id)| {
            with_engine(|e| {
                e.trackpoint(&file_id, &engine::TrackSegmentId(segment_id), index)
                    .map(|pt| {
                        let object = Object::new();
                        set(&object, "lng", pt.coordinates.lng);
                        set(&object, "lat", pt.coordinates.lat);
                        set(&object, "ele", pt.ele);
                        if let Some(time) = pt.time {
                            set(&object, "time", time as f64);
                        }
                        JsValue::from(object)
                    })
            })
            .flatten()
        })
        .unwrap_or(JsValue::UNDEFINED)
        .unchecked_into()
}

/// What was copied or cut and is waiting to be pasted, `undefined` if nothing: the kind of the
/// elements and their ids (UUID strings).
#[wasm_bindgen]
pub fn clipboard() -> Clipboard {
    with_engine(|e| {
        e.clipboard().map_or(JsValue::UNDEFINED, |clipboard| {
            let object = Object::new();
            let (kind, ids) = match clipboard.content.ids() {
                engine::ClipboardIds::Files(ids) => ("files", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Tracks(ids) => ("tracks", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Segments(ids) => ("segments", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Waypoints(ids) => ("waypoints", uuids(ids, |id| id.0)),
            };
            set(&object, "type", kind);
            set(&object, "ids", ids);
            set(&object, "cut", clipboard.cut);
            object.into()
        })
    })
    .unwrap_or(JsValue::UNDEFINED)
    .unchecked_into()
}
