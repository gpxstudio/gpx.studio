use std::{collections::HashSet, hash::Hash, rc::Rc};

use crate::{
    Apply, CommandError, File, FileId, Selection, State, Track, TrackId, TrackSegment,
    TrackSegmentId, Waypoint, WaypointId, copy_file, copy_segment, copy_track, copy_waypoint,
    edit_waypoint_chunks, insert_waypoints,
};

/// Pastes what was copied or cut (see [`crate::Clipboard`]), and empties the clipboard.
///
/// Where it goes depends on the selection, see [`crate::Clipboard::can_paste`]:
/// - nothing selected: the files are copied, and tracks and segments become new files (named
///   like their track, or like the file they come from);
/// - a file: the tracks are added to it, segments become new tracks in it, and the waypoints are
///   added to its own;
/// - a track: the segments are added to it, tracks go after it in its file;
/// - a segment: the segments go after it in its track;
/// - the waypoints or a waypoint: the waypoints are added to their file, after the waypoint.
///
/// What is cut is moved, with its ids, otherwise copies are made. The pasted elements are
/// selected.
#[derive(Debug)]
pub struct Paste;

impl Apply for Paste {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let clipboard = state
            .clipboard
            .clone()
            .filter(|clipboard| clipboard.can_paste(state.selection))
            .ok_or(CommandError::NothingToDo)?;
        let cut = clipboard.cut;
        let next = match &clipboard.selection {
            Selection::File { file_ids } => paste_files(state, file_ids, cut)?,
            Selection::Track { file_id, trk_ids } => paste_tracks(state, *file_id, trk_ids, cut)?,
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => paste_segments(state, *file_id, *trk_id, trkseg_ids, cut)?,
            Selection::Waypoints { file_id } => paste_waypoints(state, *file_id, None, cut)?,
            Selection::Waypoint { file_id, wpt_ids } => {
                paste_waypoints(state, *file_id, Some(wpt_ids), cut)?
            }
            Selection::Empty => return Err(CommandError::NothingToDo),
        };
        *state.selection = next;
        *state.clipboard = None;
        Ok(())
    }
}

/// The last of the `selected` ids in the order of `all`: the element a paste goes after.
fn last_selected<T: Copy + Eq + Hash>(
    all: impl Iterator<Item = T>,
    selected: &HashSet<T>,
) -> Option<T> {
    all.filter(|id| selected.contains(id)).last()
}

fn waypoint_ids(file: &File) -> impl Iterator<Item = WaypointId> + '_ {
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

/// Adds the file to the files, at the end of the order.
fn add_file(state: &mut State, file: File) -> FileId {
    let id = file.id;
    state.files.insert(id, Rc::new(file));
    state.order.0.push(id);
    id
}

fn new_file(name: &str, trk: Vec<Track>) -> File {
    let mut file = File {
        trk,
        ..Default::default()
    };
    file.info.name = name.to_owned();
    file
}

fn paste_files(
    state: &mut State,
    source: &HashSet<FileId>,
    cut: bool,
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

    let pasted = if cut {
        // moved to the end of the list
        state.order.move_files(&ids, usize::MAX);
        ids
    } else {
        let copies: Vec<File> = ids.iter().map(|id| copy_file(&state.files[id])).collect();
        copies
            .into_iter()
            .map(|file| add_file(state, file))
            .collect()
    };
    Ok(Selection::File {
        file_ids: pasted.into_iter().collect(),
    })
}

fn paste_tracks(
    state: &mut State,
    file_id: FileId,
    source: &HashSet<TrackId>,
    cut: bool,
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

    // where to paste, checked before anything is changed
    enum To {
        Files,
        End(FileId),
        After(FileId, TrackId),
    }
    let to = match &*state.selection {
        Selection::Empty => To::Files,
        Selection::File { file_ids } => To::End(
            last_selected(state.order.0.iter().copied(), file_ids)
                .ok_or(CommandError::NothingToDo)?,
        ),
        Selection::Track { file_id, trk_ids } => {
            let file = state.files.get(file_id).ok_or(CommandError::NothingToDo)?;
            To::After(
                *file_id,
                last_selected(file.trk.iter().map(|trk| trk.id), trk_ids)
                    .ok_or(CommandError::NothingToDo)?,
            )
        }
        _ => return Err(CommandError::NothingToDo),
    };
    if let To::End(id) | To::After(id, _) = &to
        && !state.files.contains_key(id)
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
        To::Files => {
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
                .collect::<Vec<_>>();
            Selection::File {
                file_ids: files
                    .into_iter()
                    .map(|file| add_file(state, file))
                    .collect(),
            }
        }
        To::End(id) => {
            file_mut(state, id)?.trk.extend(tracks);
            Selection::Track {
                file_id: id,
                trk_ids: ids,
            }
        }
        To::After(id, after) => {
            let file = file_mut(state, id)?;
            // the track may have just been cut away
            let at = file
                .trk
                .iter()
                .position(|trk| trk.id == after)
                .map_or(file.trk.len(), |i| i + 1);
            file.trk.splice(at..at, tracks);
            Selection::Track {
                file_id: id,
                trk_ids: ids,
            }
        }
    })
}

fn paste_segments(
    state: &mut State,
    file_id: FileId,
    trk_id: TrackId,
    source: &HashSet<TrackSegmentId>,
    cut: bool,
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

    enum To {
        Files,
        Tracks(FileId),
        End(FileId, TrackId),
        After(FileId, TrackId, TrackSegmentId),
    }
    let to = match &*state.selection {
        Selection::Empty => To::Files,
        Selection::File { file_ids } => To::Tracks(
            last_selected(state.order.0.iter().copied(), file_ids)
                .ok_or(CommandError::NothingToDo)?,
        ),
        Selection::Track { file_id, trk_ids } => {
            let file = state.files.get(file_id).ok_or(CommandError::NothingToDo)?;
            To::End(
                *file_id,
                last_selected(file.trk.iter().map(|trk| trk.id), trk_ids)
                    .ok_or(CommandError::NothingToDo)?,
            )
        }
        Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            let trk = state
                .files
                .get(file_id)
                .and_then(|file| file.trk.iter().find(|trk| trk.id == *trk_id))
                .ok_or(CommandError::NothingToDo)?;
            To::After(
                *file_id,
                *trk_id,
                last_selected(trk.trkseg.iter().map(|seg| seg.id), trkseg_ids)
                    .ok_or(CommandError::NothingToDo)?,
            )
        }
        _ => return Err(CommandError::NothingToDo),
    };
    if let To::Tracks(id) = &to
        && !state.files.contains_key(id)
    {
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
    let in_track = |state: &mut State,
                    file_id: FileId,
                    trk_id: TrackId,
                    after: Option<TrackSegmentId>,
                    segments: Vec<TrackSegment>|
     -> Result<(), CommandError> {
        let trk = file_mut(state, file_id)?
            .trk
            .iter_mut()
            .find(|trk| trk.id == trk_id)
            .ok_or(CommandError::NothingToDo)?;
        // the segment may have just been cut away
        let at = after
            .and_then(|after| trk.trkseg.iter().position(|seg| seg.id == after))
            .map_or(trk.trkseg.len(), |i| i + 1);
        trk.trkseg.splice(at..at, segments);
        Ok(())
    };

    Ok(match to {
        To::Files => {
            let files = segments
                .into_iter()
                .map(|segment| new_file(&source_name, vec![own_track(segment)]))
                .collect::<Vec<_>>();
            Selection::File {
                file_ids: files
                    .into_iter()
                    .map(|file| add_file(state, file))
                    .collect(),
            }
        }
        To::Tracks(id) => {
            let tracks: Vec<Track> = segments.into_iter().map(own_track).collect();
            let trk_ids = tracks.iter().map(|trk| trk.id).collect();
            file_mut(state, id)?.trk.extend(tracks);
            Selection::Track {
                file_id: id,
                trk_ids,
            }
        }
        To::End(file_id, trk_id) => {
            in_track(state, file_id, trk_id, None, segments)?;
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids: ids,
            }
        }
        To::After(file_id, trk_id, after) => {
            in_track(state, file_id, trk_id, Some(after), segments)?;
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids: ids,
            }
        }
    })
}

fn paste_waypoints(
    state: &mut State,
    file_id: FileId,
    source: Option<&HashSet<WaypointId>>,
    cut: bool,
) -> Result<Selection, CommandError> {
    // all the waypoints of the file when no waypoints are given
    let selected = |wpt: &Waypoint| source.is_none_or(|ids| ids.contains(&wpt.id));
    let source_file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let waypoints: Vec<Waypoint> = source_file
        .wpt
        .iter()
        .flat_map(|chunk| &chunk.wpt)
        .filter(|wpt| selected(wpt))
        .cloned()
        .collect();
    if waypoints.is_empty() {
        return Err(CommandError::NothingToDo);
    }

    let (to_file, after) = match &*state.selection {
        Selection::File { file_ids } => (
            last_selected(state.order.0.iter().copied(), file_ids)
                .ok_or(CommandError::NothingToDo)?,
            None,
        ),
        Selection::Waypoints { file_id } => (*file_id, None),
        Selection::Waypoint { file_id, wpt_ids } => {
            let file = state.files.get(file_id).ok_or(CommandError::NothingToDo)?;
            (*file_id, last_selected(waypoint_ids(file), wpt_ids))
        }
        _ => return Err(CommandError::NothingToDo),
    };
    if !state.files.contains_key(&to_file) {
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
    insert_waypoints(file_mut(state, to_file)?, after, waypoints);
    Ok(Selection::Waypoint {
        file_id: to_file,
        wpt_ids: ids,
    })
}

#[cfg(test)]
mod tests {
    use crate::{Clipboard, TrackInfo, engine::command::fixture::Fixture};

    use super::*;

    /// A file with the given tracks (name, number of segments) and number of waypoints.
    fn file(name: &str, tracks: &[(Option<&str>, usize)], waypoints: usize) -> File {
        let mut file = new_file(
            name,
            tracks
                .iter()
                .map(|(name, segments)| Track {
                    info: TrackInfo {
                        name: name.map(str::to_owned),
                        ..Default::default()
                    },
                    trkseg: (0..*segments).map(|_| TrackSegment::default()).collect(),
                    ..Default::default()
                })
                .collect(),
        );
        if waypoints > 0 {
            file.wpt = vec![Rc::new(crate::WaypointChunk {
                wpt: (0..waypoints).map(|_| Waypoint::default()).collect(),
                ..Default::default()
            })];
        }
        file
    }

    fn add(fx: &mut Fixture, file: File) -> FileId {
        let id = file.id;
        fx.files.insert(id, Rc::new(file));
        fx.order.0.push(id);
        id
    }

    fn track_ids(fx: &Fixture, id: FileId) -> Vec<TrackId> {
        fx.files[&id].trk.iter().map(|trk| trk.id).collect()
    }

    fn segment_ids(fx: &Fixture, id: FileId, trk: usize) -> Vec<TrackSegmentId> {
        fx.files[&id].trk[trk].trkseg.iter().map(|s| s.id).collect()
    }

    fn wpt_ids(fx: &Fixture, id: FileId) -> Vec<WaypointId> {
        waypoint_ids(&fx.files[&id]).collect()
    }

    fn names(fx: &Fixture) -> Vec<String> {
        fx.order
            .0
            .iter()
            .map(|id| fx.files[id].info.name.clone())
            .collect()
    }

    fn copy(fx: &mut Fixture, selection: Selection, cut: bool) {
        fx.clipboard = Clipboard::new(selection, cut);
    }

    fn paste(fx: &mut Fixture) -> Result<(), CommandError> {
        Paste.apply(&mut fx.state())
    }

    fn tracks(file_id: FileId, ids: &[TrackId]) -> Selection {
        Selection::Track {
            file_id,
            trk_ids: ids.iter().copied().collect(),
        }
    }

    fn segments(file_id: FileId, trk_id: TrackId, ids: &[TrackSegmentId]) -> Selection {
        Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids: ids.iter().copied().collect(),
        }
    }

    fn waypoints(file_id: FileId, ids: &[WaypointId]) -> Selection {
        Selection::Waypoint {
            file_id,
            wpt_ids: ids.iter().copied().collect(),
        }
    }

    fn files(ids: &[FileId]) -> Selection {
        Selection::File {
            file_ids: ids.iter().copied().collect(),
        }
    }

    #[test]
    fn test_paste_copied_tracks_into_a_file() {
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file("a", &[(Some("t0"), 1), (Some("t1"), 2), (None, 1)], 0),
        );
        let b = add(&mut fx, file("b", &[(Some("b0"), 1)], 0));
        let source = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[source[0], source[1]]), false);
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();

        // the source is untouched, copies with new ids are added at the end
        assert_eq!(track_ids(&fx, a), source);
        let in_b = track_ids(&fx, b);
        assert_eq!(in_b.len(), 3);
        assert!(!source.contains(&in_b[1]) && !source.contains(&in_b[2]));
        let names: Vec<_> = fx.files[&b]
            .trk
            .iter()
            .map(|t| t.info.name.clone())
            .collect();
        assert_eq!(
            names,
            [Some("b0".into()), Some("t0".into()), Some("t1".into())]
        );
        // the segments are copies too
        assert_eq!(fx.files[&b].trk[2].trkseg.len(), 2);
        assert_ne!(segment_ids(&fx, b, 2), segment_ids(&fx, a, 1));
        // the pasted tracks are selected, and the clipboard is empty
        assert_eq!(fx.selection, tracks(b, &in_b[1..]));
        assert_eq!(fx.clipboard, None);
    }

    #[test]
    fn test_paste_cut_tracks_moves_them() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t0"), 1), (Some("t1"), 1)], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let source = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[source[0]]), true);
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();

        assert_eq!(track_ids(&fx, a), vec![source[1]]);
        assert_eq!(track_ids(&fx, b), vec![source[0]]);
        assert_eq!(fx.selection, tracks(b, &[source[0]]));
    }

    #[test]
    fn test_paste_tracks_after_the_selected_track() {
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file(
                "a",
                &[
                    (Some("0"), 1),
                    (Some("1"), 1),
                    (Some("2"), 1),
                    (Some("3"), 1),
                ],
                0,
            ),
        );
        let t = track_ids(&fx, a);
        // copy: the block goes after the selected track
        copy(&mut fx, tracks(a, &[t[0], t[1]]), false);
        fx.selection = tracks(a, &[t[2]]);
        paste(&mut fx).unwrap();
        let names: Vec<_> = fx.files[&a]
            .trk
            .iter()
            .map(|t| t.info.name.clone().unwrap())
            .collect();
        assert_eq!(names, ["0", "1", "2", "0", "1", "3"]);

        // cut: moved after the selected track
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file("a", &[(Some("0"), 1), (Some("1"), 1), (Some("2"), 1)], 0),
        );
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        fx.selection = tracks(a, &[t[2]]);
        paste(&mut fx).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[1], t[2], t[0]]);

        // the selected track is cut itself: the tracks go at the end
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file("a", &[(Some("0"), 1), (Some("1"), 1), (Some("2"), 1)], 0),
        );
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        fx.selection = tracks(a, &[t[0]]);
        paste(&mut fx).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[1], t[2], t[0]]);
    }

    #[test]
    fn test_paste_tracks_as_new_files() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("source", &[(Some("named"), 1), (None, 1)], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0], t[1]]), false);
        fx.selection = Selection::Empty;

        paste(&mut fx).unwrap();

        // named like the track, or like the file it comes from
        assert_eq!(names(&fx), ["source", "named", "source"]);
        assert_eq!(fx.files.len(), 3);
        let new = &fx.order.0[1..];
        assert!(
            matches!(&fx.selection, Selection::File { file_ids } if file_ids.len() == 2 && new.iter().all(|id| file_ids.contains(id)))
        );
        assert_eq!(fx.files[&new[0]].trk.len(), 1);
        // the source keeps its tracks
        assert_eq!(track_ids(&fx, a), t);
    }

    #[test]
    fn test_paste_cut_tracks_as_new_files() {
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file("source", &[(Some("one"), 1), (Some("two"), 1)], 0),
        );
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
        let new = fx.order.0[1];
        assert_eq!(track_ids(&fx, new), vec![t[0]]);
    }

    #[test]
    fn test_paste_segments() {
        let build = || {
            let mut fx = Fixture::default();
            let a = add(&mut fx, file("a", &[(Some("t0"), 3), (Some("t1"), 1)], 0));
            (fx, a)
        };

        // at the end of the selected track
        let (mut fx, a) = build();
        let s = segment_ids(&fx, a, 0);
        let t = track_ids(&fx, a);
        copy(&mut fx, segments(a, t[0], &[s[0]]), false);
        fx.selection = tracks(a, &[t[1]]);
        paste(&mut fx).unwrap();
        assert_eq!(segment_ids(&fx, a, 0), s);
        let in_t1 = segment_ids(&fx, a, 1);
        assert_eq!(in_t1.len(), 2);
        assert_ne!(in_t1[1], s[0]);
        assert_eq!(fx.selection, segments(a, t[1], &in_t1[1..]));

        // after the selected segment, moved
        let (mut fx, a) = build();
        let s = segment_ids(&fx, a, 0);
        let t = track_ids(&fx, a);
        copy(&mut fx, segments(a, t[0], &[s[0]]), true);
        fx.selection = segments(a, t[0], &[s[1]]);
        paste(&mut fx).unwrap();
        assert_eq!(segment_ids(&fx, a, 0), vec![s[1], s[0], s[2]]);

        // each segment becomes a track of the selected file
        let (mut fx, a) = build();
        let s = segment_ids(&fx, a, 0);
        let t = track_ids(&fx, a);
        copy(&mut fx, segments(a, t[0], &[s[0], s[1]]), false);
        fx.selection = files(&[a]);
        paste(&mut fx).unwrap();
        let tracks_now = track_ids(&fx, a);
        assert_eq!(tracks_now.len(), 4);
        assert!(
            fx.files[&a].trk[2..]
                .iter()
                .all(|trk| trk.trkseg.len() == 1)
        );
        assert_eq!(fx.selection, tracks(a, &tracks_now[2..]));

        // each segment becomes a file, named like its track
        let (mut fx, a) = build();
        let s = segment_ids(&fx, a, 0);
        let t = track_ids(&fx, a);
        copy(&mut fx, segments(a, t[0], &[s[0], s[1]]), false);
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        assert_eq!(names(&fx), ["a", "t0", "t0"]);
        assert!(
            fx.order.0[1..]
                .iter()
                .all(|id| fx.files[id].trk[0].trkseg.len() == 1)
        );
    }

    #[test]
    fn test_paste_waypoints() {
        let build = || {
            let mut fx = Fixture::default();
            let a = add(&mut fx, file("a", &[], 4));
            let b = add(&mut fx, file("b", &[], 2));
            (fx, a, b)
        };

        // to the end of another file
        let (mut fx, a, b) = build();
        let w = wpt_ids(&fx, a);
        let before = wpt_ids(&fx, b);
        copy(&mut fx, waypoints(a, &[w[1], w[2]]), false);
        fx.selection = files(&[b]);
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, a), w);
        let now = wpt_ids(&fx, b);
        assert_eq!(now.len(), 4);
        assert_eq!(&now[..2], &before[..]);
        assert!(!w.contains(&now[2]));
        assert_eq!(fx.selection, waypoints(b, &now[2..]));

        // after the selected waypoint
        let (mut fx, a, b) = build();
        let w = wpt_ids(&fx, a);
        let before = wpt_ids(&fx, b);
        copy(&mut fx, waypoints(a, &[w[0]]), true);
        fx.selection = waypoints(b, &[before[0]]);
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, a), w[1..].to_vec());
        assert_eq!(wpt_ids(&fx, b), vec![before[0], w[0], before[1]]);

        // within the file, after a waypoint
        let (mut fx, a, _) = build();
        let w = wpt_ids(&fx, a);
        copy(&mut fx, waypoints(a, &[w[0], w[1]]), true);
        fx.selection = waypoints(a, &[w[2]]);
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, a), vec![w[2], w[0], w[1], w[3]]);
    }

    #[test]
    fn test_paste_all_the_waypoints_of_a_file() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[], 3));
        let b = add(&mut fx, file("b", &[], 1));
        let w = wpt_ids(&fx, a);
        copy(&mut fx, Selection::Waypoints { file_id: a }, false);
        fx.selection = Selection::Waypoints { file_id: b };
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, a), w);
        assert_eq!(wpt_ids(&fx, b).len(), 4);

        // moved: the source has none left
        copy(&mut fx, Selection::Waypoints { file_id: a }, true);
        fx.selection = files(&[b]);
        paste(&mut fx).unwrap();
        assert!(wpt_ids(&fx, a).is_empty());
        assert_eq!(&wpt_ids(&fx, b)[4..], &w[..]);
    }

    #[test]
    fn test_paste_files() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 1)], 1));
        let b = add(&mut fx, file("b", &[], 0));
        let c = add(&mut fx, file("c", &[], 0));
        copy(&mut fx, files(&[b, a]), false);
        fx.selection = files(&[c]);
        paste(&mut fx).unwrap();
        // copies, in the order of the files, at the end
        assert_eq!(names(&fx), ["a", "b", "c", "a", "b"]);
        assert_eq!(fx.files.len(), 5);
        assert_eq!(fx.files[&fx.order.0[3]].trk.len(), 1);
        assert_ne!(track_ids(&fx, fx.order.0[3]), track_ids(&fx, a));
        assert!(matches!(&fx.selection, Selection::File { file_ids } if file_ids.len() == 2));

        // cut: moved to the end, they keep their ids
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let c = add(&mut fx, file("c", &[], 0));
        copy(&mut fx, files(&[a]), true);
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        assert_eq!(fx.order.0, vec![b, c, a]);
        assert_eq!(fx.selection, files(&[a]));
    }

    #[test]
    fn test_nothing_to_paste() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 1)], 1));
        let t = track_ids(&fx, a);
        let w = wpt_ids(&fx, a);
        fx.selection = files(&[a]);

        // an empty clipboard
        assert_eq!(paste(&mut fx), Err(CommandError::NothingToDo));

        // a target that does not accept it (tracks cannot go to waypoints), the clipboard stays
        copy(&mut fx, tracks(a, &t), false);
        fx.selection = waypoints(a, &w);
        assert_eq!(paste(&mut fx), Err(CommandError::NothingToDo));
        assert!(fx.clipboard.is_some());
        assert_eq!(fx.selection, waypoints(a, &w));

        // elements that do not exist anymore
        copy(&mut fx, tracks(a, &[TrackId::default()]), false);
        fx.selection = files(&[a]);
        assert_eq!(paste(&mut fx), Err(CommandError::NothingToDo));
        copy(&mut fx, waypoints(a, &[WaypointId::default()]), false);
        assert_eq!(paste(&mut fx), Err(CommandError::NothingToDo));
        copy(&mut fx, files(&[FileId::default()]), false);
        fx.selection = Selection::Empty;
        assert_eq!(paste(&mut fx), Err(CommandError::NothingToDo));
        assert_eq!(fx.files.len(), 1);
        assert_eq!(fx.order.0, vec![a]);
    }
}
