//! Copying or moving elements to a place of the file tree: what paste and move are made of.
//! The elements come as the content of a clipboard, and a destination says where they go among
//! the elements already there.

use std::{collections::HashSet, rc::Rc};

use crate::{
    ClipboardContent, ClipboardSegment, ClipboardTrack, CommandError, File, FileId, Selection,
    State, Track, TrackId, TrackSegment, TrackSegmentId, Waypoint, WaypointId, copy_file,
    copy_segment, copy_track, copy_waypoint,
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

/// Where elements go. What can go where:
/// - files: among the files;
/// - tracks: among the files (each track becomes a file, named like the track, or like the file
///   it comes from), or among the tracks of a file;
/// - segments: among the files (each segment becomes a file with a track, named like its track,
///   or like its file), among the tracks of a file (each segment becomes a track), or among the
///   segments of a track;
/// - waypoints: among the waypoints of a file.
#[derive(Debug, Clone, Copy)]
pub enum Destination {
    Files(Place<FileId>),
    Tracks(FileId, Place<TrackId>),
    Segments(FileId, TrackId, Place<TrackSegmentId>),
    Waypoints(FileId, Place<WaypointId>),
}

pub fn waypoint_ids(file: &File) -> impl Iterator<Item = WaypointId> + '_ {
    file.wpt.iter().map(|wpt| wpt.id)
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
fn add_files(state: &mut State, files: Vec<Rc<File>>, place: Place<FileId>) -> Selection {
    let at = place.position(&state.order.0);
    let ids: Vec<FileId> = files.iter().map(|file| file.id).collect();
    for file in files {
        state.files.insert(file.id, file);
    }
    state.order.0.splice(at..at, ids.iter().copied());
    Selection::File {
        file_ids: ids.into_iter().collect(),
    }
}

/// Removes the elements of the content from the files, wherever they are.
pub fn remove_elements(state: &mut State, content: &ClipboardContent) {
    match content {
        ClipboardContent::Files(files) => {
            let ids: HashSet<FileId> = files.iter().map(|file| file.id).collect();
            state.files.retain(|id, _| !ids.contains(id));
            state.order.0.retain(|id| !ids.contains(id));
        }
        ClipboardContent::Tracks(tracks) => {
            let ids: HashSet<TrackId> = tracks.iter().map(|trk| trk.track.id).collect();
            for file in state.files.values_mut() {
                if file.trk.iter().any(|trk| ids.contains(&trk.id)) {
                    Rc::make_mut(file).trk.retain(|trk| !ids.contains(&trk.id));
                }
            }
        }
        ClipboardContent::Segments(segments) => {
            let ids: HashSet<TrackSegmentId> = segments.iter().map(|seg| seg.segment.id).collect();
            for file in state.files.values_mut() {
                let contains = |trk: &Track| trk.trkseg.iter().any(|seg| ids.contains(&seg.id));
                if file.trk.iter().any(contains) {
                    for trk in Rc::make_mut(file).trk.iter_mut() {
                        trk.trkseg.retain(|seg| !ids.contains(&seg.id));
                    }
                }
            }
        }
        ClipboardContent::Waypoints(waypoints) => {
            let ids: HashSet<WaypointId> = waypoints.iter().map(|wpt| wpt.id).collect();
            for file in state.files.values_mut() {
                if waypoint_ids(file).any(|id| ids.contains(&id)) {
                    Rc::make_mut(file).wpt.edit(
                        |wpt| ids.contains(&wpt.id),
                        |wpts| {
                            wpts.retain(|wpt| !ids.contains(&wpt.id));
                            true
                        },
                    );
                }
            }
        }
    }
}

/// Puts the elements of the content at the destination: copies of them, or the elements
/// themselves, with their ids, when `cut` (they are removed from where they are first). Returns
/// the selection of what was put.
pub fn transfer(
    state: &mut State,
    content: &ClipboardContent,
    cut: bool,
    to: Destination,
) -> Result<Selection, CommandError> {
    // the destination has to be there, before anything is changed
    let exists = match to {
        Destination::Files(_) => true,
        Destination::Tracks(file_id, _) => state.files.contains_key(&file_id),
        Destination::Segments(file_id, trk_id, _) => state
            .files
            .get(&file_id)
            .is_some_and(|file| file.trk.iter().any(|trk| trk.id == trk_id)),
        Destination::Waypoints(file_id, _) => state.files.contains_key(&file_id),
    };
    let valid = match (content, to) {
        (ClipboardContent::Files(_), Destination::Files(_))
        | (ClipboardContent::Tracks(_), Destination::Files(_) | Destination::Tracks(..))
        | (
            ClipboardContent::Segments(_),
            Destination::Files(_) | Destination::Tracks(..) | Destination::Segments(..),
        )
        | (ClipboardContent::Waypoints(_), Destination::Waypoints(..)) => true,
        _ => false,
    };
    let empty = match content {
        ClipboardContent::Files(files) => files.is_empty(),
        ClipboardContent::Tracks(tracks) => tracks.is_empty(),
        ClipboardContent::Segments(segments) => segments.is_empty(),
        ClipboardContent::Waypoints(waypoints) => waypoints.is_empty(),
    };
    if !exists || !valid || empty {
        return Err(CommandError::NothingToDo);
    }

    if cut {
        remove_elements(state, content);
    }
    let copy = !cut;
    match (content, to) {
        (ClipboardContent::Files(files), Destination::Files(place)) => {
            let files = files
                .iter()
                .map(|file| {
                    if copy {
                        Rc::new(copy_file(file))
                    } else {
                        file.clone()
                    }
                })
                .collect();
            Ok(add_files(state, files, place))
        }
        (ClipboardContent::Tracks(tracks), to) => transfer_tracks(state, tracks, copy, to),
        (ClipboardContent::Segments(segments), to) => transfer_segments(state, segments, copy, to),
        (ClipboardContent::Waypoints(waypoints), Destination::Waypoints(file_id, place)) => {
            transfer_waypoints(state, waypoints, copy, file_id, place)
        }
        _ => Err(CommandError::NothingToDo),
    }
}

fn transfer_tracks(
    state: &mut State,
    tracks: &[ClipboardTrack],
    copy: bool,
    to: Destination,
) -> Result<Selection, CommandError> {
    let tracks: Vec<(Track, &str)> = tracks
        .iter()
        .map(|clip| {
            let track = if copy {
                copy_track(&clip.track)
            } else {
                clip.track.clone()
            };
            (track, clip.file_name.as_str())
        })
        .collect();
    match to {
        Destination::Files(place) => {
            let files = tracks
                .into_iter()
                .map(|(track, file_name)| {
                    let name = track
                        .info
                        .name
                        .clone()
                        .unwrap_or_else(|| file_name.to_owned());
                    Rc::new(new_file(&name, vec![track]))
                })
                .collect();
            Ok(add_files(state, files, place))
        }
        Destination::Tracks(file_id, place) => {
            let tracks: Vec<Track> = tracks.into_iter().map(|(track, _)| track).collect();
            let ids: HashSet<TrackId> = tracks.iter().map(|trk| trk.id).collect();
            let file = file_mut(state, file_id)?;
            let existing: Vec<TrackId> = file.trk.iter().map(|trk| trk.id).collect();
            let at = place.position(&existing);
            file.trk.splice(at..at, tracks);
            Ok(Selection::Track {
                file_id,
                trk_ids: ids,
            })
        }
        _ => Err(CommandError::NothingToDo),
    }
}

fn transfer_segments(
    state: &mut State,
    segments: &[ClipboardSegment],
    copy: bool,
    to: Destination,
) -> Result<Selection, CommandError> {
    let segments: Vec<(TrackSegment, &str)> = segments
        .iter()
        .map(|clip| {
            let segment = if copy {
                copy_segment(&clip.segment)
            } else {
                clip.segment.clone()
            };
            (segment, clip.name.as_str())
        })
        .collect();
    // a segment on its own needs a track
    let own_track = |segment: TrackSegment| Track {
        trkseg: vec![segment],
        ..Default::default()
    };
    match to {
        Destination::Files(place) => {
            let files = segments
                .into_iter()
                .map(|(segment, name)| Rc::new(new_file(name, vec![own_track(segment)])))
                .collect();
            Ok(add_files(state, files, place))
        }
        Destination::Tracks(file_id, place) => {
            let tracks: Vec<Track> = segments
                .into_iter()
                .map(|(segment, _)| own_track(segment))
                .collect();
            let ids = tracks.iter().map(|trk| trk.id).collect();
            let file = file_mut(state, file_id)?;
            let existing: Vec<TrackId> = file.trk.iter().map(|trk| trk.id).collect();
            let at = place.position(&existing);
            file.trk.splice(at..at, tracks);
            Ok(Selection::Track {
                file_id,
                trk_ids: ids,
            })
        }
        Destination::Segments(file_id, trk_id, place) => {
            let segments: Vec<TrackSegment> =
                segments.into_iter().map(|(segment, _)| segment).collect();
            let ids: HashSet<TrackSegmentId> = segments.iter().map(|seg| seg.id).collect();
            let trk = file_mut(state, file_id)?
                .trk
                .iter_mut()
                .find(|trk| trk.id == trk_id)
                .ok_or(CommandError::NothingToDo)?;
            let existing: Vec<TrackSegmentId> = trk.trkseg.iter().map(|seg| seg.id).collect();
            let at = place.position(&existing);
            trk.trkseg.splice(at..at, segments);
            Ok(Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids: ids,
            })
        }
        Destination::Waypoints(..) => Err(CommandError::NothingToDo),
    }
}

fn transfer_waypoints(
    state: &mut State,
    waypoints: &[Waypoint],
    copy: bool,
    file_id: FileId,
    place: Place<WaypointId>,
) -> Result<Selection, CommandError> {
    let waypoints: Vec<Waypoint> = waypoints
        .iter()
        .map(|wpt| {
            if copy {
                copy_waypoint(wpt)
            } else {
                wpt.clone()
            }
        })
        .collect();
    let ids = waypoints.iter().map(|wpt| wpt.id).collect();
    let file = file_mut(state, file_id)?;
    let existing: Vec<WaypointId> = waypoint_ids(file).collect();
    file.wpt.insert_at(place.position(&existing), waypoints);
    Ok(Selection::Waypoint {
        file_id,
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
