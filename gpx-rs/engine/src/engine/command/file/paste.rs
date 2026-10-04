use std::{collections::HashSet, hash::Hash};

use crate::{
    Apply, ClipboardContent, CommandError, Destination, FileId, Place, Selection, State, TrackId,
    TrackSegmentId, WaypointId, transfer, waypoint_ids,
};

/// Pastes what was copied or cut (see [`crate::Clipboard`]).
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
/// Copies are made, with new ids, and the pasted elements are selected. What was cut is moved
/// instead, with its ids, the first time: what is still where it was is removed.
///
/// What is pasted is always the elements as they were when they were copied or cut, even if they
/// were changed or deleted since. The clipboard is kept so that it can be pasted again: after
/// what was cut was moved it is not cut anymore, and the next pastes make copies.
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
        // always the elements as they were when they were copied or cut
        let to = destination(state, &clipboard.content)?;
        let next = transfer(state, &clipboard.content, cut, to)?;

        if cut && let Some(clipboard) = state.clipboard.as_mut() {
            // moved: the next pastes make copies
            clipboard.cut = false;
        }
        *state.selection = next;
        Ok(())
    }
}

fn track_ids_of(state: &State, file_id: FileId) -> Vec<TrackId> {
    state
        .files
        .get(&file_id)
        .map(|file| file.trk.iter().map(|trk| trk.id).collect())
        .unwrap_or_default()
}

fn segment_ids_of(state: &State, file_id: FileId, trk_id: TrackId) -> Vec<TrackSegmentId> {
    state
        .files
        .get(&file_id)
        .and_then(|file| file.trk.iter().find(|trk| trk.id == trk_id))
        .map(|trk| trk.trkseg.iter().map(|seg| seg.id).collect())
        .unwrap_or_default()
}

fn waypoint_ids_of(state: &State, file_id: FileId) -> Vec<WaypointId> {
    state
        .files
        .get(&file_id)
        .map(|file| waypoint_ids(file).collect())
        .unwrap_or_default()
}

/// Where the content goes, depending on what is selected.
fn destination(state: &State, content: &ClipboardContent) -> Result<Destination, CommandError> {
    let nothing = CommandError::NothingToDo;
    let last_file = |file_ids: &HashSet<FileId>| {
        last_selected(state.order.0.iter().copied(), file_ids).ok_or(CommandError::NothingToDo)
    };
    Ok(match (content, &*state.selection) {
        (ClipboardContent::Files(_), _) => Destination::Files(Place::End),
        (ClipboardContent::Tracks(_) | ClipboardContent::Segments(_), Selection::Empty) => {
            Destination::Files(Place::End)
        }
        (
            ClipboardContent::Tracks(_) | ClipboardContent::Segments(_),
            Selection::File { file_ids },
        ) => Destination::Tracks(last_file(file_ids)?, Place::End),
        (ClipboardContent::Tracks(_), Selection::Track { file_id, trk_ids }) => {
            let last =
                last_selected(track_ids_of(state, *file_id).into_iter(), trk_ids).ok_or(nothing)?;
            Destination::Tracks(*file_id, Place::After(last))
        }
        (ClipboardContent::Segments(_), Selection::Track { file_id, trk_ids }) => {
            let last =
                last_selected(track_ids_of(state, *file_id).into_iter(), trk_ids).ok_or(nothing)?;
            Destination::Segments(*file_id, last, Place::End)
        }
        (
            ClipboardContent::Segments(_),
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            },
        ) => {
            let last = last_selected(
                segment_ids_of(state, *file_id, *trk_id).into_iter(),
                trkseg_ids,
            )
            .ok_or(nothing)?;
            Destination::Segments(*file_id, *trk_id, Place::After(last))
        }
        (ClipboardContent::Waypoints(_), Selection::File { file_ids }) => {
            Destination::Waypoints(last_file(file_ids)?, Place::End)
        }
        (ClipboardContent::Waypoints(_), Selection::Waypoints { file_id }) => {
            Destination::Waypoints(*file_id, Place::End)
        }
        (ClipboardContent::Waypoints(_), Selection::Waypoint { file_id, wpt_ids }) => {
            let last = last_selected(waypoint_ids_of(state, *file_id).into_iter(), wpt_ids)
                .ok_or(nothing)?;
            Destination::Waypoints(*file_id, Place::After(last))
        }
        _ => return Err(nothing),
    })
}

/// The last of the `selected` ids in the order of `all`: the element a paste goes after.
fn last_selected<T: Copy + Eq + Hash>(
    all: impl Iterator<Item = T>,
    selected: &HashSet<T>,
) -> Option<T> {
    all.filter(|id| selected.contains(id)).last()
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{
        Clipboard, ClipboardIds, File, FileId, Track, TrackId, TrackInfo, TrackSegment,
        TrackSegmentId, Waypoint, WaypointId, engine::command::fixture::Fixture, new_file,
    };

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
        fx.clipboard = Clipboard::new(&selection, &fx.files, &fx.order.0, cut);
    }

    /// The ids of what is in the clipboard, and whether it is cut.
    fn clipboard_state(fx: &Fixture) -> Option<(ClipboardIds, bool)> {
        fx.clipboard.as_ref().map(|c| (c.content.ids(), c.cut))
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
        // the pasted tracks are selected, and the clipboard is still there
        assert_eq!(fx.selection, tracks(b, &in_b[1..]));
        assert_eq!(
            clipboard_state(&fx),
            Some((ClipboardIds::Tracks(vec![source[0], source[1]]), false))
        );
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

        // nothing to copy: what does not exist is not put in the clipboard
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

    #[test]
    fn test_paste_a_copy_several_times() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t0"), 1), (Some("t1"), 1)], 1));
        let b = add(&mut fx, file("b", &[], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), false);
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();

        // each paste made a copy with new ids, and the source is untouched
        let in_b = track_ids(&fx, b);
        assert_eq!(in_b.len(), 3);
        assert_eq!(in_b.iter().collect::<HashSet<_>>().len(), 3);
        assert!(in_b.iter().all(|id| !t.contains(id)));
        assert_eq!(track_ids(&fx, a), t);
        assert!(fx.clipboard.is_some());

        // the selection is the last copy: the next paste goes after it
        assert_eq!(fx.selection, tracks(b, &[in_b[2]]));
        paste(&mut fx).unwrap();
        assert_eq!(track_ids(&fx, b).len(), 4);

        // the same with other elements
        let w = wpt_ids(&fx, a);
        copy(&mut fx, waypoints(a, &w), false);
        fx.selection = files(&[b]);
        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, b).len(), 2);
        assert_eq!(wpt_ids(&fx, a), w);

        copy(&mut fx, files(&[b]), false);
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();
        assert_eq!(fx.files.len(), 4);
    }

    #[test]
    fn test_paste_a_cut_moves_the_first_time_then_copies() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t0"), 1), (Some("t1"), 1)], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let c = add(&mut fx, file("c", &[], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();
        // moved with its id, and what is in the clipboard now is a copy of it
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
        assert_eq!(track_ids(&fx, b), vec![t[0]]);
        assert_eq!(
            clipboard_state(&fx),
            Some((ClipboardIds::Tracks(vec![t[0]]), false))
        );

        fx.selection = files(&[c]);
        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();
        // copies: the moved track stays where it was moved to
        assert_eq!(track_ids(&fx, b), vec![t[0]]);
        let in_c = track_ids(&fx, c);
        assert_eq!(in_c.len(), 2);
        assert!(!in_c.contains(&t[0]));
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
    }

    #[test]
    fn test_paste_cut_files_several_times() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[], 0));
        let b = add(&mut fx, file("b", &[], 0));
        copy(&mut fx, files(&[a]), true);
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        assert_eq!(fx.order.0, vec![b, a]);
        // the next pastes copy it
        paste(&mut fx).unwrap();
        assert_eq!(fx.files.len(), 3);
        assert_eq!(fx.order.0[..2], [b, a]);
    }

    /// Renames the first track of the file, as an edit would.
    fn rename_track(fx: &mut Fixture, id: FileId, name: &str) {
        let file = std::rc::Rc::make_mut(fx.files.get_mut(&id).unwrap());
        file.trk[0].info.name = Some(name.to_owned());
    }

    #[test]
    fn test_paste_the_elements_as_they_were_when_copied() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("original"), 1)], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), false);
        rename_track(&mut fx, a, "edited");
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();
        let pasted = &fx.files[&b].trk[0];
        assert_eq!(pasted.info.name.as_deref(), Some("original"));
        // the source keeps what was done to it
        assert_eq!(fx.files[&a].trk[0].info.name.as_deref(), Some("edited"));

        // and each time
        paste(&mut fx).unwrap();
        assert!(
            fx.files[&b]
                .trk
                .iter()
                .all(|trk| trk.info.name.as_deref() == Some("original"))
        );
        assert_eq!(fx.files[&b].trk.len(), 2);
    }

    #[test]
    fn test_paste_a_cut_as_it_was_when_cut() {
        let mut fx = Fixture::default();
        let a = add(
            &mut fx,
            file("a", &[(Some("original"), 1), (Some("other"), 1)], 0),
        );
        let b = add(&mut fx, file("b", &[], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        rename_track(&mut fx, a, "edited");
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();
        // what is in the clipboard is moved, the edited version is not what is pasted
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
        assert_eq!(track_ids(&fx, b), vec![t[0]]);
        assert_eq!(fx.files[&b].trk[0].info.name.as_deref(), Some("original"));
    }

    #[test]
    fn test_paste_after_the_elements_were_deleted() {
        let delete_file = |fx: &mut Fixture, id: FileId| {
            fx.files.remove(&id);
            fx.order.0.retain(|other| *other != id);
        };

        // copied tracks, waypoints, segments and files are still there to be pasted
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 2)], 2));
        let b = add(&mut fx, file("b", &[], 0));
        let t = track_ids(&fx, a);
        let s = segment_ids(&fx, a, 0);
        let w = wpt_ids(&fx, a);

        copy(&mut fx, tracks(a, &t), false);
        fx.selection = files(&[b]);
        delete_file(&mut fx, a);
        paste(&mut fx).unwrap();
        assert_eq!(fx.files[&b].trk.len(), 1);
        assert_eq!(fx.files[&b].trk[0].trkseg.len(), 2);
        // the copy of a track comes from a file that is gone: named like the track
        fx.selection = Selection::Empty;
        paste(&mut fx).unwrap();
        assert_eq!(names(&fx), ["b", "t"]);

        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 2)], 2));
        let b = add(&mut fx, file("b", &[], 0));
        let (t, s, w) = (track_ids(&fx, a), segment_ids(&fx, a, 0), wpt_ids(&fx, a));
        copy(&mut fx, segments(a, t[0], &s), false);
        fx.selection = files(&[b]);
        delete_file(&mut fx, a);
        paste(&mut fx).unwrap();
        assert_eq!(fx.files[&b].trk.len(), 2);

        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 2)], 2));
        let b = add(&mut fx, file("b", &[], 0));
        let w = wpt_ids(&fx, a);
        copy(&mut fx, waypoints(a, &w), false);
        fx.selection = files(&[b]);
        delete_file(&mut fx, a);
        paste(&mut fx).unwrap();
        assert_eq!(wpt_ids(&fx, b).len(), 2);

        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t"), 1)], 0));
        copy(&mut fx, files(&[a]), false);
        fx.selection = Selection::Empty;
        delete_file(&mut fx, a);
        assert!(fx.files.is_empty());
        paste(&mut fx).unwrap();
        paste(&mut fx).unwrap();
        assert_eq!(fx.files.len(), 2);
        assert_eq!(names(&fx), ["a", "a"]);
        let _ = (s, w);
    }

    #[test]
    fn test_paste_a_cut_after_the_elements_were_deleted() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[(Some("t0"), 1), (Some("t1"), 1)], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let t = track_ids(&fx, a);
        copy(&mut fx, tracks(a, &[t[0]]), true);
        // deleted before it is pasted
        std::rc::Rc::make_mut(fx.files.get_mut(&a).unwrap())
            .trk
            .retain(|trk| trk.id != t[0]);
        fx.selection = files(&[b]);

        paste(&mut fx).unwrap();
        // nothing to remove, the track is where it was pasted, with its id
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
        assert_eq!(track_ids(&fx, b), vec![t[0]]);
        assert_eq!(
            clipboard_state(&fx),
            Some((ClipboardIds::Tracks(vec![t[0]]), false))
        );
    }
}
