//! Ids, which cross as strings (one id) or as concatenated 16-byte UUIDs (several).

use gpx_engine::{self as engine, FileId};

pub(crate) fn uuid_list(bytes: &[u8]) -> Option<Vec<uuid::Uuid>> {
    let (chunks, rest) = bytes.as_chunks::<16>();
    rest.is_empty()
        .then(|| chunks.iter().map(|c| uuid::Uuid::from_bytes(*c)).collect())
}

pub(crate) fn file_ids(bytes: &[u8]) -> Option<Vec<FileId>> {
    uuid_list(bytes).map(|ids| ids.into_iter().map(FileId).collect())
}

pub(crate) fn parse_file_id(id: &str) -> Option<FileId> {
    uuid::Uuid::parse_str(id).ok().map(FileId)
}

pub(crate) fn same_len(a: &[f64], b: &[f64], c: &[f64]) -> bool {
    a.len() == b.len() && b.len() == c.len()
}

pub(crate) fn parse_waypoint_id(id: &str) -> Option<engine::WaypointId> {
    uuid::Uuid::parse_str(id).ok().map(engine::WaypointId)
}
