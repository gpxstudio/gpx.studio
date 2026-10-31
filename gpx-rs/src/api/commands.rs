//! The functions that edit the files or change the selection.

use uuid::Uuid;

use super::dto::*;
use crate::{self as engine, Action, Command, Engine, History, LngLat, LngLatBounds};

/// Executes an action and tells what it did.
pub fn execute<H: History>(engine: &mut Engine<H>, action: Action) -> Outcome {
    match engine.execute(action) {
        Ok(outcome) => Outcome::new(&outcome, None),
        Err(error) => Outcome::failed(error.to_string()),
    }
}

pub fn edit<H: History>(engine: &mut Engine<H>, command: Command) -> Outcome {
    execute(engine, Action::Edit(command))
}

fn file_ids(ids: &[Uuid]) -> Vec<engine::FileId> {
    ids.iter().copied().map(engine::FileId).collect()
}

// Selection

/// Selects files. Unknown files are ignored, and selecting nothing deselects everything.
pub fn select<H: History>(
    engine: &mut Engine<H>,
    file_ids_: &[Uuid],
    mode: engine::SelectMode,
) -> Outcome {
    select_elements(
        engine,
        engine::Selection::File {
            file_ids: file_ids(file_ids_).into_iter().collect(),
        },
        mode,
    )
}

/// Selects elements: they are merged with the selection when it holds elements of the same kind in
/// the same place (same file, same track for segments), otherwise they replace it.
pub fn select_elements<H: History>(
    engine: &mut Engine<H>,
    selection: engine::Selection,
    mode: engine::SelectMode,
) -> Outcome {
    execute(engine, Action::Select { selection, mode })
}

/// Selects all the elements of the same kind as the selected ones, in the same place: all the
/// files, the routes or the tracks of the file, the segments of the track, the waypoints of the file. All the
/// files when nothing is selected.
pub fn select_all<H: History>(engine: &mut Engine<H>) -> Outcome {
    execute(engine, Action::SelectAll)
}

/// Moves the selection to the next (`down`) or previous element of the same kind, like the arrow
/// keys do in the file list. With `add` (shift + arrow), the element is added to the selection,
/// otherwise it replaces it.
pub fn arrow_select<H: History>(engine: &mut Engine<H>, down: bool, add: bool) -> Outcome {
    execute(engine, Action::ArrowSelect { down, add })
}

pub fn select_routes<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    route_ids: &[Uuid],
    mode: engine::SelectMode,
) -> Outcome {
    let selection = engine::Selection::Route {
        file_id: engine::FileId(file_id),
        rte_ids: route_ids.iter().copied().map(engine::RouteId).collect(),
    };
    select_elements(engine, selection, mode)
}

pub fn select_tracks<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    track_ids: &[Uuid],
    mode: engine::SelectMode,
) -> Outcome {
    let selection = engine::Selection::Track {
        file_id: engine::FileId(file_id),
        trk_ids: track_ids.iter().copied().map(engine::TrackId).collect(),
    };
    select_elements(engine, selection, mode)
}

pub fn select_segments<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    track_id: Uuid,
    segment_ids: &[Uuid],
    mode: engine::SelectMode,
) -> Outcome {
    let selection = engine::Selection::TrackSegment {
        file_id: engine::FileId(file_id),
        trk_id: engine::TrackId(track_id),
        trkseg_ids: segment_ids
            .iter()
            .copied()
            .map(engine::TrackSegmentId)
            .collect(),
    };
    select_elements(engine, selection, mode)
}

/// Selects the node standing for all the waypoints of a file.
pub fn select_waypoint_group<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    mode: engine::SelectMode,
) -> Outcome {
    let selection = engine::Selection::Waypoints {
        file_id: engine::FileId(file_id),
    };
    select_elements(engine, selection, mode)
}

pub fn select_waypoints<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    waypoint_ids: &[Uuid],
    mode: engine::SelectMode,
) -> Outcome {
    let selection = engine::Selection::Waypoint {
        file_id: engine::FileId(file_id),
        wpt_ids: waypoint_ids
            .iter()
            .copied()
            .map(engine::WaypointId)
            .collect(),
    };
    select_elements(engine, selection, mode)
}

// History

pub fn undo<H: History>(engine: &mut Engine<H>) -> Outcome {
    execute(engine, Action::Undo)
}

pub fn redo<H: History>(engine: &mut Engine<H>) -> Outcome {
    execute(engine, Action::Redo)
}

// Files

/// Creates a file and selects it. With `route`, it starts with a route. With `lng` and `lat`, it
/// starts with a segment that holds that trackpoint (at `ele`, 0 by default): the one of its route
/// with `route`, of a track otherwise.
pub fn new_file<H: History>(
    engine: &mut Engine<H>,
    name: &str,
    lng: Option<f64>,
    lat: Option<f64>,
    ele: Option<f64>,
    route: bool,
) -> Outcome {
    let trackpoint = lng.zip(lat).map(|(lng, lat)| engine::NewTrackpoint {
        lng,
        lat,
        ele: ele.unwrap_or_default(),
    });
    edit(
        engine,
        Command::New(engine::New {
            name,
            trackpoint,
            route,
        }),
    )
}

/// Loads files as a single command (one undo step). The files are in `data`, one after the other,
/// `lengths` being the number of bytes of each one. `names`: the name of each file when its data
/// has none (the name on disk, without extension). The files that cannot be read are skipped, the
/// first one that was read is selected.
pub fn load_files<H: History>(
    engine: &mut Engine<H>,
    data: &[u8],
    lengths: &[usize],
    names: &[String],
) -> Outcome {
    if lengths.len() != names.len() {
        return Outcome::failed(format!(
            "{} lengths for {} names",
            lengths.len(),
            names.len()
        ));
    }
    let mut files = Vec::with_capacity(names.len());
    let mut offset = 0;
    for (length, name) in lengths.iter().zip(names) {
        let end = offset + *length;
        let Some(data) = data.get(offset..end) else {
            return Outcome::failed(format!("the data of {name} is shorter than its length"));
        };
        files.push(engine::Load { data, name });
        offset = end;
    }
    edit(engine, Command::LoadFiles(engine::LoadFiles { files }))
}

/// Brings changes of the files from the outside in (see [`engine::SyncFiles`]): each file is
/// `(id, data, name)`, and replaces the file of that id, or is added if there is none; `name` is
/// its name when its data has none. The files to `remove` are deleted. The selection is left alone.
pub fn sync_files<H: History>(
    engine: &mut Engine<H>,
    files: &[(Uuid, &[u8], &str)],
    remove: &[Uuid],
) -> Outcome {
    let files = files
        .iter()
        .map(|(id, data, name)| engine::ExternalFile {
            id: engine::FileId(*id),
            data,
            name,
        })
        .collect();
    edit(
        engine,
        Command::SyncFiles(engine::SyncFiles {
            files,
            remove: file_ids(remove),
        }),
    )
}

pub fn duplicate<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::Duplicate(engine::Duplicate))
}

/// Deletes the selected elements. With `whole_files`, the files holding the selected elements are
/// deleted instead, even if only a track or a waypoint is selected.
pub fn delete<H: History>(engine: &mut Engine<H>, whole_files: bool) -> Outcome {
    edit(engine, Command::Delete(engine::Delete { whole_files }))
}

pub fn delete_all<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::DeleteAll(engine::DeleteAll))
}

/// Moves the files to `index` among the other files, in the given order (not undoable).
pub fn reorder<H: History>(engine: &mut Engine<H>, file_ids_: &[Uuid], index: usize) -> Outcome {
    execute(
        engine,
        Action::Reorder {
            file_ids: file_ids(file_ids_),
            index,
        },
    )
}

/// Names a file in all its states, as if it had always been called so (not undoable): for a file
/// that is written to a file of another name, whose name it takes.
pub fn rename_file<H: History>(engine: &mut Engine<H>, file_id: Uuid, name: &str) -> Outcome {
    execute(
        engine,
        Action::Rename {
            file_id: engine::FileId(file_id),
            name: name.to_owned(),
        },
    )
}

/// Puts the selected elements in the clipboard. Nothing happens when nothing is selected.
pub fn copy<H: History>(engine: &mut Engine<H>) -> Outcome {
    execute(engine, Action::Copy)
}

/// Like `copy`, but the elements are moved when they are pasted.
pub fn cut<H: History>(engine: &mut Engine<H>) -> Outcome {
    execute(engine, Action::Cut)
}

/// Pastes the clipboard according to the selection (see `can_paste`). What is pasted is always the
/// elements as they were when they were copied or cut, even if they were changed or deleted since.
/// It can be pasted several times: what was copied is copied again, what was cut is moved the first
/// time (and the clipboard is not cut after that), then it is copied.
pub fn paste<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::Paste(engine::Paste))
}

/// Moves elements to a place of the file tree, keeping their ids, like dragging and dropping them
/// does. The moved elements are selected.
///
/// Files can only go among the files; tracks among the files (each becomes a file) or the tracks
/// of a file; segments among the files (each becomes a file), the tracks of a file (each becomes
/// a track) or the segments of a track; waypoints, or all the waypoints of a file, among the
/// waypoints of a file.
pub fn move_elements<H: History>(
    engine: &mut Engine<H>,
    what: Selection,
    to: MoveTarget,
) -> Outcome {
    edit(
        engine,
        Command::Move(engine::Move {
            what: what.into(),
            to: to.into(),
        }),
    )
}

pub fn metadata<H: History>(engine: &mut Engine<H>, name: &str, desc: &str) -> Outcome {
    edit(engine, Command::Metadata(engine::Metadata { name, desc }))
}

/// Only the given fields are changed.
pub fn style<H: History>(
    engine: &mut Engine<H>,
    color: Option<&str>,
    opacity: Option<f64>,
    width: Option<f64>,
) -> Outcome {
    edit(
        engine,
        Command::Style(engine::Style {
            color,
            opacity,
            width,
        }),
    )
}

/// Converts the selected routes to tracks, or the selected tracks or segments to routes.
pub fn convert<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::Convert(engine::Convert))
}

pub fn new_route<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::NewRoute(engine::NewRoute))
}

pub fn new_track<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::NewTrack(engine::NewTrack))
}

pub fn new_track_segment<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::NewTrackSegment(engine::NewTrackSegment))
}

// Waypoints. The strings that are empty are the fields that the waypoint does not have.

/// Adds a waypoint to each selected file (or to the file of the selected elements).
#[allow(clippy::too_many_arguments)]
pub fn new_waypoint<H: History>(
    engine: &mut Engine<H>,
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> Outcome {
    edit(
        engine,
        Command::NewWaypoint(engine::NewWaypoint {
            lng,
            lat,
            ele,
            name,
            desc,
            icon,
            link,
        }),
    )
}

/// Moves a waypoint of a file, whatever is selected.
pub fn move_waypoint<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    waypoint_id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
) -> Outcome {
    edit(
        engine,
        Command::MoveWaypoint(engine::MoveWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
            lng,
            lat,
            ele,
        }),
    )
}

/// Deletes a waypoint of a file, whatever is selected.
pub fn delete_waypoint<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    waypoint_id: Uuid,
) -> Outcome {
    edit(
        engine,
        Command::DeleteWaypoint(engine::DeleteWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
        }),
    )
}

/// Changes a waypoint of a file, whatever is selected: its name, description, icon, link,
/// position and elevation.
#[allow(clippy::too_many_arguments)]
pub fn update_waypoint<H: History>(
    engine: &mut Engine<H>,
    file_id: Uuid,
    waypoint_id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> Outcome {
    edit(
        engine,
        Command::EditWaypoint(engine::EditWaypoint {
            file_id: engine::FileId(file_id),
            waypoint_id: engine::WaypointId(waypoint_id),
            lng,
            lat,
            ele,
            name,
            desc,
            icon,
            link,
        }),
    )
}

// Tools

pub fn reverse<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::Reverse(engine::Reverse))
}

/// Adds to each selected segment a reversed copy of itself (without repeating its last point), so
/// that it goes back to where it started.
pub fn round_trip<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(engine, Command::RoundTrip(engine::RoundTrip))
}

/// Keeps the trackpoints `start` to `end` (both included) of the selection, counted over its
/// segments one after the other, and removes the others (and what is left empty).
pub fn crop<H: History>(engine: &mut Engine<H>, start: u32, end: u32) -> Outcome {
    if start > end {
        return Outcome::failed(format!("the range {start}..{end} is reversed"));
    }
    edit(engine, Command::Crop(engine::Crop { start, end }))
}

/// Removes the trackpoints of the selection that are less than `tolerance` meters away from the
/// line of their neighbours, except the ends of the segments.
pub fn reduce<H: History>(engine: &mut Engine<H>, tolerance: f64) -> Outcome {
    edit(engine, Command::Reduce(engine::Reduce { tolerance }))
}

/// Sets the timestamps of the selection, which starts at `start_time` (ms since the epoch): the
/// trackpoints that have some keep their durations multiplied by `ratio`, the others follow the
/// previous one at `speed` (km/h).
pub fn change_timestamps<H: History>(
    engine: &mut Engine<H>,
    start_time: f64,
    speed: f64,
    ratio: f64,
) -> Outcome {
    edit(
        engine,
        Command::Time(engine::Time {
            start_time: start_time as i64,
            kind: engine::TimeKind::Change { speed, ratio },
        }),
    )
}

/// Makes up timestamps for the selection, which starts at `start_time` (ms since the epoch) and
/// lasts `total_time` seconds.
pub fn create_artificial_timestamps<H: History>(
    engine: &mut Engine<H>,
    start_time: f64,
    total_time: f64,
) -> Outcome {
    edit(
        engine,
        Command::Time(engine::Time {
            start_time: start_time as i64,
            kind: engine::TimeKind::Artificial { total_time },
        }),
    )
}

/// Merges the selection into its first element. `remove_gaps` brings the parts that are connected
/// closer in time, if they have timestamps. Merged files are kept (and the result is a new file) if
/// the history needs it, see [`History::KEEPS_ORIGINALS`].
pub fn merge<H: History>(
    engine: &mut Engine<H>,
    type_: engine::MergeType,
    remove_gaps: bool,
) -> Outcome {
    edit(
        engine,
        Command::Merge(engine::Merge {
            type_,
            remove_gaps,
            keep_originals: H::KEEPS_ORIGINALS,
        }),
    )
}

/// Extracted files are kept (and the result is new files) if the history needs it, see
/// [`History::KEEPS_ORIGINALS`].
pub fn extract<H: History>(engine: &mut Engine<H>) -> Outcome {
    edit(
        engine,
        Command::Extract(engine::Extract {
            keep_originals: H::KEEPS_ORIGINALS,
        }),
    )
}

/// Sets the elevation of the trackpoints of the selection, one elevation per trackpoint.
pub fn elevation<H: History>(engine: &mut Engine<H>, ele: &[f64]) -> Outcome {
    edit(engine, Command::Elevation(engine::Elevation { ele }))
}

/// Removes the trackpoints and/or waypoints of the selection inside (or outside) a rectangle.
#[allow(clippy::too_many_arguments)]
pub fn clean<H: History>(
    engine: &mut Engine<H>,
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    type_: engine::CleanType,
    trkpt: bool,
    wpt: bool,
) -> Outcome {
    edit(
        engine,
        Command::Clean(engine::Clean {
            bounds: LngLatBounds {
                sw: LngLat {
                    lng: west,
                    lat: south,
                },
                ne: LngLat {
                    lng: east,
                    lat: north,
                },
            },
            type_,
            trkpt,
            wpt,
        }),
    )
}

// Routing
//
// The indices of the trackpoints and of the anchors are the ones of the routing buffers: they only
// mean something for the `revision` they were read with (`routing_revision`), and the commands
// that use them do nothing if the selection is not the one of that revision anymore.

/// Makes the call `f`, unless the selection is not the one of the revision anymore.
fn at_revision<H: History>(
    engine: &mut Engine<H>,
    revision: u32,
    f: impl FnOnce(&mut Engine<H>) -> Outcome,
) -> Outcome {
    if engine.routing().revision == revision {
        f(engine)
    } else {
        Outcome::failed("the selection changed since the routing buffers were read")
    }
}

/// Replaces the trackpoints `start..end` of the selection by the given ones, in a single segment
/// (a pure insertion if `start == end`, a pure removal without new points). `attributes` holds the
/// surface, highway, SAC scale and MTB scale of the new points, as intervals, and `anchors` the
/// indices among the new points of the ones that become anchors.
#[allow(clippy::too_many_arguments)]
pub fn route<H: History>(
    engine: &mut Engine<H>,
    revision: u32,
    start: u32,
    end: u32,
    lng: &[f64],
    lat: &[f64],
    ele: &[f64],
    attributes: &RouteAttributes,
    anchors: &[u32],
) -> Outcome {
    if lng.len() != lat.len() || lat.len() != ele.len() {
        return Outcome::failed("lng, lat and ele differ in length");
    }
    at_revision(engine, revision, |engine| {
        edit(
            engine,
            Command::Reroute(engine::Reroute {
                start,
                end,
                lng,
                lat,
                ele,
                surface: attributes.surface.view(),
                highway: attributes.highway.view(),
                sac_scale: attributes.sac_scale.view(),
                mtb_scale: attributes.mtb_scale.view(),
                anchors,
            }),
        )
    })
}

/// Makes an anchor of the point of the selected segments that is the closest to the coordinates,
/// inserting a trackpoint on the path if none is there.
pub fn insert_anchor<H: History>(
    engine: &mut Engine<H>,
    revision: u32,
    lng: f64,
    lat: f64,
) -> Outcome {
    at_revision(engine, revision, |engine| {
        edit(
            engine,
            Command::InsertAnchor(engine::InsertAnchor { lng, lat }),
        )
    })
}

/// Makes the trackpoint `index` of the selection the start of its segment, which is a loop (the
/// trackpoints before it go to the end, and the loop closes on it).
pub fn change_loop_start<H: History>(engine: &mut Engine<H>, revision: u32, index: u32) -> Outcome {
    at_revision(engine, revision, |engine| {
        edit(
            engine,
            Command::ChangeLoopStart(engine::ChangeLoopStart { index }),
        )
    })
}

/// Cuts the file, the route, the track or the segment (see `SplitType`) of the trackpoint `at` of the
/// selection in two, there: the trackpoint ends the first part and starts the second one. A file that
/// is cut is kept (and its two parts are new files) if the history needs it, see
/// [`History::KEEPS_ORIGINALS`].
pub fn split<H: History>(
    engine: &mut Engine<H>,
    revision: u32,
    at: u32,
    split_type: engine::SplitType,
) -> Outcome {
    at_revision(engine, revision, |engine| {
        edit(
            engine,
            Command::Split(engine::Split {
                at,
                split_type,
                keep_originals: H::KEEPS_ORIGINALS,
            }),
        )
    })
}
