//! The functions that read the state of the engine.
//!
//! The files are described by one ordered list of ids and one structure per file, so that the UI
//! can react to what changed only: after each command, its `Outcome` tells which structures to
//! (re)read or drop and whether the order changed. The trackpoints of a segment and the waypoints
//! of a file are in the same order as the coordinates of their buffers.

use uuid::Uuid;

use super::dto::*;
use crate::{self as engine, Engine, FileId, History};

/// Ids of the files in display order.
pub fn file_order<H: History>(engine: &Engine<H>) -> Vec<String> {
    ids(engine.order())
}

/// Structure of a file, `None` if the id is unknown.
pub fn file_structure<H: History>(engine: &Engine<H>, file_id: Uuid) -> Option<FileStructure> {
    engine
        .file_structure(&FileId(file_id))
        .map(FileStructure::new)
}

/// Global statistics of a file, `None` if the id is unknown.
pub fn file_statistics<H: History>(engine: &Engine<H>, file_id: Uuid) -> Option<GlobalStatistics> {
    engine
        .file_statistics(&FileId(file_id))
        .map(|stats| GlobalStatistics::new(&stats))
}

/// The current selection.
pub fn selection<H: History>(engine: &Engine<H>) -> Selection {
    engine.selection().into()
}

/// What was copied or cut and is waiting to be pasted.
pub fn clipboard<H: History>(engine: &Engine<H>) -> Option<Clipboard> {
    engine.clipboard().map(Clipboard::new)
}

pub fn can_undo<H: History>(engine: &Engine<H>) -> bool {
    engine.can_undo()
}

pub fn can_redo<H: History>(engine: &Engine<H>) -> bool {
    engine.can_redo()
}

/// Whether the clipboard can be pasted with the current selection.
pub fn can_paste<H: History>(engine: &Engine<H>) -> bool {
    engine.can_paste()
}

/// All the data of a waypoint of a file, `None` if it does not exist.
pub fn waypoint<H: History>(
    engine: &Engine<H>,
    file_id: Uuid,
    waypoint_id: Uuid,
) -> Option<WaypointDetails> {
    engine
        .waypoint(&FileId(file_id), &engine::WaypointId(waypoint_id))
        .map(WaypointDetails::new)
}

/// A trackpoint of a segment of a file, `None` if it does not exist.
pub fn trackpoint<H: History>(
    engine: &Engine<H>,
    file_id: Uuid,
    segment_id: Uuid,
    index: usize,
) -> Option<TrackpointDetails> {
    engine
        .trackpoint(&FileId(file_id), &engine::TrackSegmentId(segment_id), index)
        .map(TrackpointDetails::new)
}

/// A file as GPX (UTF-8 bytes), `None` if it does not exist. The options say which data of the
/// trackpoints to keep.
pub fn export_file<H: History>(
    engine: &Engine<H>,
    file_id: Uuid,
    options: engine::ExportOptions,
) -> Option<Vec<u8>> {
    engine.export(&FileId(file_id), options)
}

/// The data that some files have, so that the ones that none has are not offered when exporting
/// them: a bit for the time (1), heart rate (2), cadence (4), temperature (8), power (16) and the
/// OpenStreetMap data (32).
pub fn exportable_data<H: History>(engine: &Engine<H>, file_ids: &[Uuid]) -> u8 {
    let ids: Vec<FileId> = file_ids.iter().copied().map(FileId).collect();
    let data = engine.exportable_data(&ids);
    [
        data.time, data.hr, data.cad, data.atemp, data.power, data.osm,
    ]
    .iter()
    .enumerate()
    .fold(0, |bits, (i, on)| bits | (u8::from(*on) << i))
}

/// For each trackpoint of the selection (numbered as in the statistics), the highest tolerance
/// (m) of `reduce` that keeps it: infinite for the ends of the segments.
pub fn reduction_distances<H: History>(engine: &Engine<H>) -> Vec<f64> {
    engine.reduction_distances()
}

// Coordinates, as flat `[lng, lat, ...]` slices. Compare `rev` / `waypointsRev` of the file
// structures with the previous ones to know which ones actually changed.

/// Coordinates of the trackpoints of a segment (empty if the id is unknown).
pub fn segment_coordinates<H: History>(engine: &Engine<H>, segment_id: Uuid) -> &[f64] {
    engine.segment_coordinates(&engine::TrackSegmentId(segment_id))
}

/// Coordinates of the waypoints of a file (empty if the id is unknown).
pub fn waypoint_coordinates<H: History>(engine: &Engine<H>, file_id: Uuid) -> &[f64] {
    engine.waypoint_coordinates(&FileId(file_id))
}

// Statistics of the selection

/// Global statistics of the whole selection (the buffers below cover it).
pub fn selection_statistics<H: History>(engine: &Engine<H>) -> GlobalStatistics {
    GlobalStatistics::new(&engine.statistics().global)
}

/// Global statistics of the trackpoints from `start` to `end` (both included) of the selection,
/// as indexed by the buffers. `None` when the range is not in the selection.
pub fn slice_statistics<H: History>(
    engine: &Engine<H>,
    start: usize,
    end: usize,
) -> Option<GlobalStatistics> {
    engine
        .statistics()
        .slice(start, end)
        .map(|stats| GlobalStatistics::new(&stats))
}

macro_rules! buffers {
    ($($name:ident),*) => {$(
        pub fn $name<H: History>(engine: &Engine<H>) -> &[f64] {
            &engine.statistics().$name
        }
    )*};
}

// One entry per trackpoint of the selection.
buffers!(
    total_distance,
    elevation_gain,
    elevation_loss,
    lng,
    lat,
    ele
);

macro_rules! optional_buffers {
    ($($name:ident: $type:ty),*) => {$(
        /// `None` when no trackpoint of the selection has the value, else an entry per trackpoint,
        /// the missing ones being NaN (`NO_TIME` for the timestamps, 0 before the first trackpoint
        /// that has them for the cumulative distances and durations).
        pub fn $name<H: History>(engine: &Engine<H>) -> Option<&[$type]> {
            engine.statistics().$name.as_deref()
        }
    )*};
}

optional_buffers!(moving_distance: f64, speed: f64, hr: f64, cad: f64, atemp: f64, power: f64);
optional_buffers!(total_time: i64, moving_time: i64);

// The smoothed elevation segments of the selection, over which the slope is averaged, as
// intervals of trackpoints: `slope_segment_starts` holds the index of the first trackpoint of each
// segment, and `slope_segment_slopes` its slope (%). Their length is in `selection_point`.

pub fn slope_segment_starts<H: History>(engine: &Engine<H>) -> &[u32] {
    &engine.statistics().slope_segments.starts
}

pub fn slope_segment_slopes<H: History>(engine: &Engine<H>) -> &[f64] {
    &engine.statistics().slope_segments.slopes
}

/// What the buffers do not hold for each trackpoint of the selection, for the one at `index`
/// (numbered as in the buffers), `None` if there is none: for example the one that is hovered on
/// the elevation profile.
pub fn selection_point<H: History>(engine: &Engine<H>, index: usize) -> Option<SelectionPoint> {
    let stats = engine.statistics();
    if index >= stats.len() {
        return None;
    }
    let categories = engine.categories();
    let name = |intervals: &engine::Intervals, categories: &engine::Categories| {
        let value = intervals.value_at(index);
        let code = value.checked_sub(1)?;
        categories.name(code).map(str::to_owned)
    };
    let segment = stats.slope_segments.at(index);
    let finite = |value: f64| value.is_finite().then_some(value);
    Some(SelectionPoint {
        slope: finite(stats.slope[index]),
        time: stats
            .time
            .as_ref()
            .map(|time| time[index])
            .filter(|time| *time != engine::NO_TIME)
            .map(|time| time as f64),
        slope_segment_slope: segment.and_then(|i| finite(stats.slope_segments.slopes[i])),
        slope_segment_distance: segment.and_then(|i| finite(stats.slope_segments.distances[i])),
        surface: name(&stats.surface, &categories.surface),
        highway: name(&stats.highway, &categories.highway),
        sac_scale: name(&stats.sac_scale, &categories.sac_scale),
        mtb_scale: name(&stats.mtb_scale, &categories.mtb_scale),
    })
}

// Surface, highway, SAC scale and MTB scale of the trackpoints, as intervals of trackpoints that
// have the same value: `<name>_starts` holds the index of the first trackpoint of each interval,
// and `<name>_values` its value (0 when unknown, else 1 + the index in the names of the category).
// A value that is unknown for every trackpoint is a single interval.
macro_rules! categories {
    ($starts:ident, $values:ident, $names:ident, $field:ident) => {
        pub fn $starts<H: History>(engine: &Engine<H>) -> &[u32] {
            &engine.statistics().$field.starts
        }

        pub fn $values<H: History>(engine: &Engine<H>) -> &[u8] {
            &engine.statistics().$field.values
        }

        /// The names of the category, in the order of their codes. The list only grows: a name
        /// keeps its index.
        pub fn $names<H: History>(engine: &Engine<H>) -> &[String] {
            engine.categories().$field.names()
        }
    };
}

categories!(surface_starts, surface_values, surfaces, surface);
categories!(highway_starts, highway_values, highways, highway);
categories!(sac_scale_starts, sac_scale_values, sac_scales, sac_scale);
categories!(mtb_scale_starts, mtb_scale_values, mtb_scales, mtb_scale);

// The anchors of the routing tool among the trackpoints of the selection (numbered as in the
// statistics). The ends of the segments are always anchors.

/// The index in the selection of each anchor.
pub fn anchor_indices<H: History>(engine: &Engine<H>) -> &[u32] {
    &engine.routing().anchor_indices
}

/// The lowest map zoom level at which each anchor is shown.
pub fn anchor_zooms<H: History>(engine: &Engine<H>) -> &[u8] {
    &engine.routing().anchor_zooms
}

/// Index in the selection of the first trackpoint of each selected segment that has some.
pub fn segment_starts<H: History>(engine: &Engine<H>) -> &[u32] {
    &engine.routing().segment_starts
}

/// The id of each selected segment that has trackpoints, as `segment_starts`.
pub fn segment_ids<H: History>(engine: &Engine<H>) -> Vec<String> {
    engine
        .routing()
        .segment_ids
        .iter()
        .map(|id| id.0.to_string())
        .collect()
}

/// Changes when the selected segments or their trackpoints change: the indices in the selection
/// are only valid while it stays the same.
pub fn routing_revision<H: History>(engine: &Engine<H>) -> u32 {
    engine.routing().revision
}
