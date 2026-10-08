//! Turning engine types into JS objects and back.

use gpx_engine::{self as engine, FileId};
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::prelude::*;

use crate::ts::*;

pub(crate) fn property(object: &JsValue, key: &str) -> Option<JsValue> {
    Reflect::get(object, &key.into())
        .ok()
        .filter(|value| !value.is_undefined())
}

pub(crate) fn uuid_property(object: &JsValue, key: &str) -> Option<uuid::Uuid> {
    uuid::Uuid::parse_str(&property(object, key)?.as_string()?).ok()
}

pub(crate) fn uuids_property(object: &JsValue, key: &str) -> Option<Vec<uuid::Uuid>> {
    Array::from(&property(object, key)?)
        .iter()
        .map(|id| uuid::Uuid::parse_str(&id.as_string()?).ok())
        .collect()
}

/// The inverse of `selection_object`.
pub(crate) fn parse_selection(value: &JsValue) -> Option<engine::Selection> {
    use engine::Selection as S;
    let file_id = || uuid_property(value, "fileId").map(FileId);
    Some(match property(value, "type")?.as_string()?.as_str() {
        "empty" => S::Empty,
        "file" => S::File {
            file_ids: uuids_property(value, "fileIds")?
                .into_iter()
                .map(FileId)
                .collect(),
        },
        "track" => S::Track {
            file_id: file_id()?,
            trk_ids: uuids_property(value, "trackIds")?
                .into_iter()
                .map(engine::TrackId)
                .collect(),
        },
        "segment" => S::TrackSegment {
            file_id: file_id()?,
            trk_id: engine::TrackId(uuid_property(value, "trackId")?),
            trkseg_ids: uuids_property(value, "segmentIds")?
                .into_iter()
                .map(engine::TrackSegmentId)
                .collect(),
        },
        "waypoints" => S::Waypoints {
            file_id: file_id()?,
        },
        "waypoint" => S::Waypoint {
            file_id: file_id()?,
            wpt_ids: uuids_property(value, "waypointIds")?
                .into_iter()
                .map(engine::WaypointId)
                .collect(),
        },
        _ => return None,
    })
}

pub(crate) fn parse_move_target(value: &JsValue) -> Option<engine::MoveTarget> {
    use engine::MoveTarget as T;
    // a negative index is the start, an infinite one is the end
    let index = property(value, "index")?.as_f64()?.max(0.0) as usize;
    let file_id = || uuid_property(value, "fileId").map(FileId);
    Some(match property(value, "type")?.as_string()?.as_str() {
        "files" => T::Files { index },
        "tracks" => T::Tracks {
            file_id: file_id()?,
            index,
        },
        "segments" => T::Segments {
            file_id: file_id()?,
            trk_id: engine::TrackId(uuid_property(value, "trackId")?),
            index,
        },
        "waypoints" => T::Waypoints {
            file_id: file_id()?,
            index,
        },
        _ => return None,
    })
}

pub(crate) fn set(object: &Object, key: &str, value: impl Into<JsValue>) {
    Reflect::set(object, &key.into(), &value.into()).unwrap();
}

pub(crate) fn array<T>(items: &[T], f: impl Fn(&T) -> JsValue) -> Array {
    items.iter().map(f).collect()
}

pub(crate) fn ids(items: &[FileId]) -> Array {
    array(items, |id| id.0.to_string().into())
}

pub(crate) fn named_node(id: uuid::Uuid, name: Option<&str>) -> Object {
    let node = Object::new();
    set(&node, "id", id.to_string());
    if let Some(name) = name {
        set(&node, "name", name);
    }
    node
}

pub(crate) fn structure_object(file: &engine::FileStructure) -> Object {
    let node = named_node(file.id.0, Some(&file.name));
    if let Some(desc) = &file.desc {
        set(&node, "desc", desc.as_str());
    }
    set(
        &node,
        "tracks",
        array(&file.tracks, |trk| {
            let node = named_node(trk.id.0, trk.name.as_deref());
            if let Some(desc) = &trk.desc {
                set(&node, "desc", desc.as_str());
            }
            if let Some(color) = &trk.color {
                set(&node, "color", color.as_str());
            }
            if let Some(opacity) = trk.opacity {
                set(&node, "opacity", opacity);
            }
            if let Some(width) = trk.width {
                set(&node, "width", width);
            }
            set(
                &node,
                "segments",
                array(&trk.segments, |seg| {
                    let node = named_node(seg.id.0, None);
                    set(&node, "rev", seg.rev_id.0.to_string());
                    set(&node, "length", seg.len as f64);
                    node.into()
                }),
            );
            node.into()
        }),
    );
    set(
        &node,
        "waypoints",
        array(&file.waypoints, |wpt| {
            let node = named_node(wpt.id.0, wpt.name.as_deref());
            if let Some(sym) = &wpt.sym {
                set(&node, "sym", sym.as_str());
            }
            node.into()
        }),
    );
    set(&node, "waypointsRev", file.wpt_rev_id.0.to_string());
    node
}

pub(crate) fn statistics_object(stats: &engine::GlobalStatistics) -> GlobalStatistics {
    let object = Object::new();
    let optional = |key: &str, value: Option<f64>| {
        if let Some(value) = value {
            set(&object, key, value);
        }
    };
    let seconds = |ms: Option<i64>| ms.map(|ms| ms as f64 / 1000.0);
    let average = |key: &str, average: &engine::Average| {
        if let Some(avg) = average.avg() {
            let value = Object::new();
            set(&value, "avg", avg);
            set(&value, "count", f64::from(average.count));
            set(&object, key, value);
        }
    };
    set(&object, "totalDistance", stats.total_distance);
    optional("movingDistance", stats.moving_distance);
    optional("totalTime", seconds(stats.total_time));
    optional("movingTime", seconds(stats.moving_time));
    set(&object, "elevationGain", stats.elevation_gain);
    set(&object, "elevationLoss", stats.elevation_loss);
    optional("startTime", stats.start_time.map(|t| t as f64));
    optional("endTime", stats.end_time.map(|t| t as f64));
    optional("totalSpeed", stats.total_speed());
    optional("movingSpeed", stats.moving_speed());
    average("hr", &stats.hr);
    average("cad", &stats.cad);
    average("atemp", &stats.atemp);
    average("power", &stats.power);
    let (sw, ne) = (&stats.bounds.sw, &stats.bounds.ne);
    if sw.lng <= ne.lng && sw.lat <= ne.lat {
        let bounds = Object::new();
        set(&bounds, "west", sw.lng);
        set(&bounds, "south", sw.lat);
        set(&bounds, "east", ne.lng);
        set(&bounds, "north", ne.lat);
        set(&object, "bounds", bounds);
    }
    object.unchecked_into()
}

pub(crate) fn uuids<T>(
    items: impl IntoIterator<Item = T>,
    uuid: impl Fn(T) -> uuid::Uuid,
) -> Array {
    items
        .into_iter()
        .map(|item| JsValue::from(uuid(item).to_string()))
        .collect()
}

pub(crate) fn selection_object(selection: &engine::Selection) -> Object {
    use engine::Selection as S;
    let object = Object::new();
    match selection {
        S::Empty => set(&object, "type", "empty"),
        S::File { file_ids } => {
            set(&object, "type", "file");
            set(&object, "fileIds", uuids(file_ids, |id| id.0));
        }
        S::Track { file_id, trk_ids } => {
            set(&object, "type", "track");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "trackIds", uuids(trk_ids, |id| id.0));
        }
        S::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            set(&object, "type", "segment");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "trackId", trk_id.0.to_string());
            set(&object, "segmentIds", uuids(trkseg_ids, |id| id.0));
        }
        S::Waypoints { file_id } => {
            set(&object, "type", "waypoints");
            set(&object, "fileId", file_id.0.to_string());
        }
        S::Waypoint { file_id, wpt_ids } => {
            set(&object, "type", "waypoint");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "waypointIds", uuids(wpt_ids, |id| id.0));
        }
    }
    object
}

/// The outcome of a call. `error` is what it says about why nothing was done, if that is so.
pub(crate) fn outcome_object(outcome: &engine::Outcome, error: Option<&str>) -> Outcome {
    let object = Object::new();
    let diff = outcome.diff.clone().unwrap_or_default();
    set(&object, "changed", outcome.changed);
    set(&object, "orderChanged", outcome.order_changed);
    set(&object, "selectionChanged", outcome.selection_changed);
    set(&object, "clipboardChanged", outcome.clipboard_changed);
    set(&object, "added", ids(&diff.added));
    set(&object, "modified", ids(&diff.modified));
    set(&object, "removed", ids(&diff.removed));
    if let Some(error) = error {
        set(&object, "error", error);
    }
    object.unchecked_into()
}
