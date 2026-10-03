use crate::{FileId, LngLatBounds};

/// A user action, decoded from the WASM boundary.
///
/// Bulk data (coordinates, file bytes) is borrowed straight from the wasm-bindgen argument
/// buffers, so a command is built without copying; the engine only copies what it keeps.
pub enum Command<'a> {
    // File commands
    New {
        name: &'a str,
    },
    Load {
        data: &'a [u8],
    },
    Duplicate,
    Delete,
    DeleteAll,
    // Edit commands
    Metadata {
        name: &'a str,
        desc: &'a str,
    },
    Style {
        color: Option<&'a str>,
        opacity: Option<f64>,
        width: Option<f64>,
    },
    NewTrack,
    NewTrackSegment,
    // Tools
    Reverse,
    Append {
        lng: &'a [f64],
        lat: &'a [f64],
        ele: &'a [f64],
    },
    Replace {
        start: u32,
        end: u32,
        lng: &'a [f64],
        lat: &'a [f64],
        ele: &'a [f64],
    },
    NewWaypoint {
        lng: f64,
        lat: f64,
        ele: f64,
        name: &'a str,
        desc: &'a str,
        icon: &'a str,
        link: &'a str,
    },
    MoveWaypoint {
        lng: f64,
        lat: f64,
        ele: f64,
    },
    Crop {
        start: u32,
        end: u32,
    },
    Split {
        at: u32,
    },
    Time,
    Merge {
        type_: MergeType,
    },
    Extract,
    Elevation {
        ele: &'a [f64],
    },
    Clean {
        bounds: LngLatBounds,
        type_: CleanType,
        trkpt: bool,
        wpt: bool,
    },
    // Undo-redo
    Undo,
    Redo,
    // Selection
    Select {
        file_ids: Vec<FileId>,
    },
    AddSelect {
        file_ids: Vec<FileId>,
    },
    SelectAll,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeType {
    Connect,
    Group,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanType {
    Inside,
    Outside,
}
