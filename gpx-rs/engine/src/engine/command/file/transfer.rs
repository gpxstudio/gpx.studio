//! Copying or moving elements of the files to a place of the file tree: what paste and move are
//! made of. The elements come from where they are found by id, and the place says where they
//! go among the elements already there.

use std::{collections::HashSet, rc::Rc};

use crate::{
    CommandError, File, FileId, Selection, State, Track, TrackId, TrackSegment, TrackSegmentId,
    Waypoint, WaypointId, copy_file, copy_segment, copy_track, copy_waypoint, edit_waypoint_chunks,
    insert_waypoints_at,
};

/// Where elements are put, among the others of the same list.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Place<T> {
    /// After all of them.
    End,
    /// Right after the one with this id, or at the end if it is not there (anymore).
    After(T),
    /// At this position (at the end if it is past it).
    Index(usize),
}

impl<T: Copy + PartialEq> Place<T> {
    /// The position in the list of `ids`.
    pub fn position(&self, ids: &[T]) -> usize {
        match self {
            Place::End => ids.len(),
            Place::After(id) => ids
                .iter()
                .position(|other| other == id)
                .map_or(ids.len(), |i| i + 1),
            Place::Index(index) => (*index).min(ids.len()),
        }
    }
}

pub fn waypoint_ids(file: &File) -> impl Iterator<Item = WaypointId> + '_ {
    file.wpt
        .iter()
        .flat_map(|chunk| &chunk.wpt)
        .map(|wpt| wpt.id)
}

fn file_mut<'a>(state: &'a mut State, id: FileId) -> Result<&'a mut File, CommandError> {
    state
        .files
        .get_mut(&id)
        .map(Rc::make_mut)
        .ok_or(CommandError::NothingToDo)
}

pub fn new_file(name: &str, trk: Vec<Track>) -> File {
    let mut file = File {
        trk,
        ..Default::default()
    };
    file.info.name = name.to_owned();
    file
}

/// Adds the files to the state, at `place` in the order of the files.
fn add_files(state: &mut State, files: Vec<File>, place: Place<FileId>) -> HashSet<FileId> {
    let at = place.position(&state.order.0);
    let ids: Vec<FileId> = files.iter().map(|file| file.id).collect();
    for file in files {
        state.files.insert(file.id, Rc::new(file));
    }
    state.order.0.splice(at..at, ids.iter().copied());
    ids.into_iter().collect()
}

/// Copies the files, or moves them in the order of the files when `cut`.
pub fn transfer_files(
    state: &mut State,
    source: &HashSet<FileId>,
    cut: bool,
    place: Place<FileId>,
) -> Result<Selection, CommandError> {
    let ids: Vec<FileId> = state
        .order
        .0
        .iter()
        .copied()
        .filter(|id| source.contains(id) && state.files.contains_key(id))
        .collect();
    if ids.is_empty() {
        return Err(CommandError::NothingToDo);
    }

    let file_ids = if cut {
        // the position is among the files that stay
        let others: Vec<FileId> = state
            .order
            .0
            .iter()
            .copied()
            .filter(|id| !ids.contains(id))
            .collect();
        state.order.move_files(&ids, place.position(&others));
        ids.into_iter().collect()
    } else {
        let copies = ids.iter().map(|id| copy_file(&state.files[id])).collect();
        add_files(state, copies, place)
    };
    Ok(Selection::File { file_ids })
}

/// Where tracks go.
#[derive(Debug, Clone, Copy)]
pub enum TracksTo {
    /// Each track becomes a new file, named like the track, or like the file it comes from.
    Files(Place<FileId>),
    /// The tracks go in a file.
    File(FileId, Place<TrackId>),
}

/// Copies the tracks, or moves them (with their ids) when `cut`.
pub fn transfer_tracks(
    state: &mut State,
    file_id: FileId,
    source: &HashSet<TrackId>,
    cut: bool,
    to: TracksTo,
) -> Result<Selection, CommandError> {
    let source_file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let source_name = source_file.info.name.clone();
    let tracks: Vec<Track> = source_file
        .trk
        .iter()
        .filter(|trk| source.contains(&trk.id))
        .cloned()
        .collect();
    if tracks.is_empty() {
        return Err(CommandError::NothingToDo);
    }
    if let TracksTo::File(id, _) = to
        && !state.files.contains_key(&id)
    {
        return Err(CommandError::NothingToDo);
    }

    if cut {
        file_mut(state, file_id)?
            .trk
            .retain(|trk| !source.contains(&trk.id));
    }
    let tracks: Vec<Track> = if cut {
        tracks
    } else {
        tracks.iter().map(copy_track).collect()
    };
    let ids: HashSet<TrackId> = tracks.iter().map(|trk| trk.id).collect();

    Ok(match to {
        TracksTo::Files(place) => {
            let files = tracks
                .into_iter()
                .map(|track| {
                    let name = track
                        .info
                        .name
                        .clone()
                        .unwrap_or_else(|| source_name.clone());
                    new_file(&name, vec![track])
                })
                .collect();
            Selection::File {
                file_ids: add_files(state, files, place),
            }
        }
        TracksTo::File(id, place) => {
            let file = file_mut(state, id)?;
            let existing: Vec<TrackId> = file.trk.iter().map(|trk| trk.id).collect();
            let at = place.position(&existing);
            file.trk.splice(at..at, tracks);
            Selection::Track {
                file_id: id,
                trk_ids: ids,
            }
        }
    })
}

/// Where segments go.
#[derive(Debug, Clone, Copy)]
pub enum SegmentsTo {
    /// Each segment becomes a new file with a track, named like the track it comes from.
    Files(Place<FileId>),
    /// Each segment becomes a new track of the file.
    Tracks(FileId, Place<TrackId>),
    /// The segments go in a track of a file.
    Track(FileId, TrackId, Place<TrackSegmentId>),
}

/// Copies the segments of a track, or moves them (with their ids) when `cut`.
pub fn transfer_segments(
    state: &mut State,
    file_id: FileId,
    trk_id: TrackId,
    source: &HashSet<TrackSegmentId>,
    cut: bool,
    to: SegmentsTo,
) -> Result<Selection, CommandError> {
    let source_file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let source_track = source_file
        .trk
        .iter()
        .find(|trk| trk.id == trk_id)
        .ok_or(CommandError::NothingToDo)?;
    let source_name = source_track
        .info
        .name
        .clone()
        .unwrap_or_else(|| source_file.info.name.clone());
    let segments: Vec<TrackSegment> = source_track
        .trkseg
        .iter()
        .filter(|seg| source.contains(&seg.id))
        .cloned()
        .collect();
    if segments.is_empty() {
        return Err(CommandError::NothingToDo);
    }
    let destination_exists = match to {
        SegmentsTo::Files(_) => true,
        SegmentsTo::Tracks(id, _) => state.files.contains_key(&id),
        SegmentsTo::Track(id, trk, _) => state
            .files
            .get(&id)
            .is_some_and(|file| file.trk.iter().any(|t| t.id == trk)),
    };
    if !destination_exists {
        return Err(CommandError::NothingToDo);
    }

    if cut {
        let file = file_mut(state, file_id)?;
        if let Some(trk) = file.trk.iter_mut().find(|trk| trk.id == trk_id) {
            trk.trkseg.retain(|seg| !source.contains(&seg.id));
        }
    }
    let segments: Vec<TrackSegment> = if cut {
        segments
    } else {
        segments.iter().map(copy_segment).collect()
    };
    let ids: HashSet<TrackSegmentId> = segments.iter().map(|seg| seg.id).collect();

    // a segment on its own needs a track
    let own_track = |segment: TrackSegment| Track {
        trkseg: vec![segment],
        ..Default::default()
    };

    Ok(match to {
        SegmentsTo::Files(place) => {
            let files = segments
                .into_iter()
                .map(|segment| new_file(&source_name, vec![own_track(segment)]))
                .collect();
            Selection::File {
                file_ids: add_files(state, files, place),
            }
        }
        SegmentsTo::Tracks(id, place) => {
            let tracks: Vec<Track> = segments.into_iter().map(own_track).collect();
            let trk_ids = tracks.iter().map(|trk| trk.id).collect();
            let file = file_mut(state, id)?;
            let existing: Vec<TrackId> = file.trk.iter().map(|trk| trk.id).collect();
            let at = place.position(&existing);
            file.trk.splice(at..at, tracks);
            Selection::Track {
                file_id: id,
                trk_ids,
            }
        }
        SegmentsTo::Track(id, trk_id, place) => {
            let trk = file_mut(state, id)?
                .trk
                .iter_mut()
                .find(|trk| trk.id == trk_id)
                .ok_or(CommandError::NothingToDo)?;
            let existing: Vec<TrackSegmentId> = trk.trkseg.iter().map(|seg| seg.id).collect();
            let at = place.position(&existing);
            trk.trkseg.splice(at..at, segments);
            Selection::TrackSegment {
                file_id: id,
                trk_id,
                trkseg_ids: ids,
            }
        }
    })
}

/// Copies waypoints of a file (all of them when `source` is `None`) to `place` among the
/// waypoints of the file `to`, or moves them (with their ids) when `cut`.
pub fn transfer_waypoints(
    state: &mut State,
    file_id: FileId,
    source: Option<&HashSet<WaypointId>>,
    cut: bool,
    to: FileId,
    place: Place<WaypointId>,
) -> Result<Selection, CommandError> {
    let selected = |wpt: &Waypoint| source.is_none_or(|ids| ids.contains(&wpt.id));
    let source_file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let waypoints: Vec<Waypoint> = source_file
        .wpt
        .iter()
        .flat_map(|chunk| &chunk.wpt)
        .filter(|wpt| selected(wpt))
        .cloned()
        .collect();
    if waypoints.is_empty() || !state.files.contains_key(&to) {
        return Err(CommandError::NothingToDo);
    }

    if cut {
        edit_waypoint_chunks(file_mut(state, file_id)?, selected, |wpts| {
            wpts.retain(|wpt| !selected(wpt));
            true
        });
    }
    let waypoints: Vec<Waypoint> = if cut {
        waypoints
    } else {
        waypoints.iter().map(copy_waypoint).collect()
    };
    let ids = waypoints.iter().map(|wpt| wpt.id).collect();
    let file = file_mut(state, to)?;
    let existing: Vec<WaypointId> = waypoint_ids(file).collect();
    insert_waypoints_at(file, place.position(&existing), waypoints);
    Ok(Selection::Waypoint {
        file_id: to,
        wpt_ids: ids,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_place_position() {
        let ids = [1, 2, 3];
        assert_eq!(Place::End.position(&ids), 3);
        assert_eq!(Place::After(1).position(&ids), 1);
        assert_eq!(Place::After(3).position(&ids), 3);
        // not there: at the end
        assert_eq!(Place::After(9).position(&ids), 3);
        assert_eq!(Place::Index(0).position(&ids), 0);
        assert_eq!(Place::Index(2).position(&ids), 2);
        assert_eq!(Place::Index(10).position(&ids), 3);
        assert_eq!(Place::<i32>::End.position(&[]), 0);
        assert_eq!(Place::<i32>::Index(4).position(&[]), 0);
    }
}
