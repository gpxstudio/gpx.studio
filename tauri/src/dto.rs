//! What crosses to the frontend, as JSON: the same shapes as the objects of the WASM interface
//! (`gpx-rs/wasm/src/ts.rs` holds their TypeScript types).

use gpx_engine::{self as engine, FileId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Bytes that cross as they are: typed arrays (little-endian), GPX files.
pub type Bytes = tauri::ipc::Response;

pub fn f64s(values: &[f64]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}

pub fn i64s(values: &[i64]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}

pub fn u32s(values: &[u32]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}

/// An array that can be absent: the first byte tells whether it is there, the array follows.
pub fn optional(array: Option<Vec<u8>>) -> Bytes {
    let mut bytes = vec![u8::from(array.is_some())];
    bytes.extend(array.unwrap_or_default());
    Bytes::new(bytes)
}

pub fn ids(items: &[FileId]) -> Vec<String> {
    items.iter().map(|id| id.0.to_string()).collect()
}

// Outcome

/// What a call that edits the files or changes the selection did.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    changed: bool,
    order_changed: bool,
    selection_changed: bool,
    clipboard_changed: bool,
    added: Vec<String>,
    modified: Vec<String>,
    removed: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl Outcome {
    pub fn new(outcome: &engine::Outcome, error: Option<String>) -> Self {
        let diff = outcome.diff.clone().unwrap_or_default();
        Self {
            changed: outcome.changed,
            order_changed: outcome.order_changed,
            selection_changed: outcome.selection_changed,
            clipboard_changed: outcome.clipboard_changed,
            added: ids(&diff.added),
            modified: ids(&diff.modified),
            removed: ids(&diff.removed),
            error,
        }
    }

    /// The outcome of a call that did nothing and has nothing to say.
    pub fn failed_none() -> Self {
        Self::new(&engine::Outcome::default(), None)
    }

    /// What a call that does nothing returns.
    pub fn failed(message: impl Into<String>) -> Self {
        Self::new(&engine::Outcome::default(), Some(message.into()))
    }
}

// Selection and clipboard

#[derive(Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Selection {
    Empty,
    File {
        file_ids: Vec<Uuid>,
    },
    Track {
        file_id: Uuid,
        track_ids: Vec<Uuid>,
    },
    Segment {
        file_id: Uuid,
        track_id: Uuid,
        segment_ids: Vec<Uuid>,
    },
    Waypoints {
        file_id: Uuid,
    },
    Waypoint {
        file_id: Uuid,
        waypoint_ids: Vec<Uuid>,
    },
}

impl From<&engine::Selection> for Selection {
    fn from(selection: &engine::Selection) -> Self {
        use engine::Selection as S;
        match selection {
            S::Empty => Self::Empty,
            S::File { file_ids } => Self::File {
                file_ids: file_ids.iter().map(|id| id.0).collect(),
            },
            S::Track { file_id, trk_ids } => Self::Track {
                file_id: file_id.0,
                track_ids: trk_ids.iter().map(|id| id.0).collect(),
            },
            S::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => Self::Segment {
                file_id: file_id.0,
                track_id: trk_id.0,
                segment_ids: trkseg_ids.iter().map(|id| id.0).collect(),
            },
            S::Waypoints { file_id } => Self::Waypoints { file_id: file_id.0 },
            S::Waypoint { file_id, wpt_ids } => Self::Waypoint {
                file_id: file_id.0,
                waypoint_ids: wpt_ids.iter().map(|id| id.0).collect(),
            },
        }
    }
}

impl From<Selection> for engine::Selection {
    fn from(selection: Selection) -> Self {
        use engine::Selection as S;
        match selection {
            Selection::Empty => S::Empty,
            Selection::File { file_ids } => S::File {
                file_ids: file_ids.into_iter().map(FileId).collect(),
            },
            Selection::Track { file_id, track_ids } => S::Track {
                file_id: FileId(file_id),
                trk_ids: track_ids.into_iter().map(engine::TrackId).collect(),
            },
            Selection::Segment {
                file_id,
                track_id,
                segment_ids,
            } => S::TrackSegment {
                file_id: FileId(file_id),
                trk_id: engine::TrackId(track_id),
                trkseg_ids: segment_ids
                    .into_iter()
                    .map(engine::TrackSegmentId)
                    .collect(),
            },
            Selection::Waypoints { file_id } => S::Waypoints {
                file_id: FileId(file_id),
            },
            Selection::Waypoint {
                file_id,
                waypoint_ids,
            } => S::Waypoint {
                file_id: FileId(file_id),
                wpt_ids: waypoint_ids.into_iter().map(engine::WaypointId).collect(),
            },
        }
    }
}

/// Where moved elements go. A negative index is the start, an infinite one the end (which JSON
/// writes as `null`, so the frontend sends a very large number instead).
#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum MoveTarget {
    Files {
        index: f64,
    },
    Tracks {
        file_id: Uuid,
        index: f64,
    },
    Segments {
        file_id: Uuid,
        track_id: Uuid,
        index: f64,
    },
    Waypoints {
        file_id: Uuid,
        index: f64,
    },
}

impl From<MoveTarget> for engine::MoveTarget {
    fn from(target: MoveTarget) -> Self {
        use engine::MoveTarget as T;
        let index = |index: f64| index.max(0.0) as usize;
        match target {
            MoveTarget::Files { index: i } => T::Files { index: index(i) },
            MoveTarget::Tracks { file_id, index: i } => T::Tracks {
                file_id: FileId(file_id),
                index: index(i),
            },
            MoveTarget::Segments {
                file_id,
                track_id,
                index: i,
            } => T::Segments {
                file_id: FileId(file_id),
                trk_id: engine::TrackId(track_id),
                index: index(i),
            },
            MoveTarget::Waypoints { file_id, index: i } => T::Waypoints {
                file_id: FileId(file_id),
                index: index(i),
            },
        }
    }
}

#[derive(Serialize)]
pub struct Clipboard {
    #[serde(rename = "type")]
    kind: &'static str,
    ids: Vec<String>,
    cut: bool,
}

impl Clipboard {
    pub fn new(clipboard: &engine::Clipboard) -> Self {
        let strings = |ids: Vec<Uuid>| ids.iter().map(Uuid::to_string).collect();
        let (kind, ids) = match clipboard.content.ids() {
            engine::ClipboardIds::Files(ids) => {
                ("files", strings(ids.into_iter().map(|id| id.0).collect()))
            }
            engine::ClipboardIds::Tracks(ids) => {
                ("tracks", strings(ids.into_iter().map(|id| id.0).collect()))
            }
            engine::ClipboardIds::Segments(ids) => (
                "segments",
                strings(ids.into_iter().map(|id| id.0).collect()),
            ),
            engine::ClipboardIds::Waypoints(ids) => (
                "waypoints",
                strings(ids.into_iter().map(|id| id.0).collect()),
            ),
        };
        Self {
            kind,
            ids,
            cut: clipboard.cut,
        }
    }
}

// Files

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStructure {
    id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    desc: Option<String>,
    tracks: Vec<TrackNode>,
    waypoints: Vec<WaypointNode>,
    waypoints_rev: String,
}

#[derive(Serialize)]
struct TrackNode {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    desc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    opacity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<f64>,
    segments: Vec<SegmentNode>,
}

#[derive(Serialize)]
struct SegmentNode {
    id: String,
    rev: String,
    length: f64,
}

#[derive(Serialize)]
struct WaypointNode {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sym: Option<String>,
}

impl FileStructure {
    pub fn new(file: &engine::FileStructure) -> Self {
        Self {
            id: file.id.0.to_string(),
            name: file.name.clone(),
            desc: file.desc.clone(),
            tracks: file
                .tracks
                .iter()
                .map(|trk| TrackNode {
                    id: trk.id.0.to_string(),
                    name: trk.name.clone(),
                    desc: trk.desc.clone(),
                    color: trk.color.clone(),
                    opacity: trk.opacity,
                    width: trk.width,
                    segments: trk
                        .segments
                        .iter()
                        .map(|seg| SegmentNode {
                            id: seg.id.0.to_string(),
                            rev: seg.rev_id.0.to_string(),
                            length: seg.len as f64,
                        })
                        .collect(),
                })
                .collect(),
            waypoints: file
                .waypoints
                .iter()
                .map(|wpt| WaypointNode {
                    id: wpt.id.0.to_string(),
                    name: wpt.name.clone(),
                    sym: wpt.sym.clone(),
                })
                .collect(),
            waypoints_rev: file.wpt_rev_id.0.to_string(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStatistics {
    total_distance: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    moving_distance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    moving_time: Option<f64>,
    elevation_gain: f64,
    elevation_loss: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    start_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_speed: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    moving_speed: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bounds: Option<Bounds>,
}

#[derive(Serialize)]
struct Bounds {
    west: f64,
    south: f64,
    east: f64,
    north: f64,
}

impl GlobalStatistics {
    pub fn new(stats: &engine::GlobalStatistics) -> Self {
        let seconds = |ms: Option<i64>| ms.map(|ms| ms as f64 / 1000.0);
        let (sw, ne) = (&stats.bounds.sw, &stats.bounds.ne);
        Self {
            total_distance: stats.total_distance,
            moving_distance: stats.moving_distance,
            total_time: seconds(stats.total_time),
            moving_time: seconds(stats.moving_time),
            elevation_gain: stats.elevation_gain,
            elevation_loss: stats.elevation_loss,
            start_time: stats.start_time.map(|t| t as f64),
            end_time: stats.end_time.map(|t| t as f64),
            total_speed: stats.total_speed(),
            moving_speed: stats.moving_speed(),
            bounds: (sw.lng <= ne.lng && sw.lat <= ne.lat).then_some(Bounds {
                west: sw.lng,
                south: sw.lat,
                east: ne.lng,
                north: ne.lat,
            }),
        }
    }
}

#[derive(Serialize)]
pub struct WaypointDetails {
    id: String,
    lng: f64,
    lat: f64,
    ele: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    desc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cmt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sym: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    links: Option<Vec<Link>>,
}

#[derive(Serialize)]
struct Link {
    href: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
}

impl WaypointDetails {
    pub fn new(wpt: &engine::Waypoint) -> Self {
        Self {
            id: wpt.id.0.to_string(),
            lng: wpt.coordinates.lng,
            lat: wpt.coordinates.lat,
            ele: wpt.ele,
            time: wpt.time.map(|t| t as f64),
            name: wpt.name.clone(),
            desc: wpt.desc.clone(),
            cmt: wpt.cmt.clone(),
            sym: wpt.sym.clone(),
            links: (!wpt.links.is_empty()).then(|| {
                wpt.links
                    .iter()
                    .map(|link| Link {
                        href: link.href.clone(),
                        text: link.text.clone(),
                    })
                    .collect()
            }),
        }
    }
}

#[derive(Serialize)]
pub struct TrackpointDetails {
    lng: f64,
    lat: f64,
    ele: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    time: Option<f64>,
}

impl TrackpointDetails {
    pub fn new(pt: &engine::Trackpoint) -> Self {
        Self {
            lng: pt.coordinates.lng,
            lat: pt.coordinates.lat,
            ele: pt.ele,
            time: pt.time.map(|t| t as f64),
        }
    }
}

// Enumerations

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SelectMode {
    Replace,
    Add,
    Toggle,
}

impl From<SelectMode> for engine::SelectMode {
    fn from(m: SelectMode) -> Self {
        match m {
            SelectMode::Replace => Self::Replace,
            SelectMode::Add => Self::Add,
            SelectMode::Toggle => Self::Toggle,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MergeType {
    Connect,
    Group,
}

impl From<MergeType> for engine::MergeType {
    fn from(t: MergeType) -> Self {
        match t {
            MergeType::Connect => Self::Connect,
            MergeType::Group => Self::Group,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SplitType {
    Files,
    Tracks,
    Segments,
}

impl From<SplitType> for engine::SplitType {
    fn from(t: SplitType) -> Self {
        match t {
            SplitType::Files => Self::Files,
            SplitType::Tracks => Self::Tracks,
            SplitType::Segments => Self::Segments,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CleanType {
    Inside,
    Outside,
}

impl From<CleanType> for engine::CleanType {
    fn from(t: CleanType) -> Self {
        match t {
            CleanType::Inside => Self::Inside,
            CleanType::Outside => Self::Outside,
        }
    }
}

// Routing

/// A category of the trackpoints of a route, as in `RouteCategory` of the engine.
#[derive(Default, Deserialize)]
pub struct RouteCategory {
    pub starts: Vec<u32>,
    pub values: Vec<u8>,
    pub names: Vec<String>,
}

impl RouteCategory {
    pub fn view(&self) -> engine::RouteCategory<'_> {
        engine::RouteCategory {
            starts: &self.starts,
            values: &self.values,
            names: &self.names,
        }
    }
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RouteAttributes {
    pub surface: RouteCategory,
    pub highway: RouteCategory,
    pub sac_scale: RouteCategory,
    pub mtb_scale: RouteCategory,
}
