use crate::{
    Apply, CommandError, FileId, Place, SegmentsTo, Selection, State, TrackId, TracksTo,
    transfer_files, transfer_segments, transfer_tracks, transfer_waypoints,
};

/// Where moved elements go: a list of the file tree, and the position in it. The position is
/// counted among the elements of the list that are not moved, like the position of a dragged
/// element in the list it is dropped in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoveTarget {
    /// The list of files.
    Files { index: usize },
    /// The tracks of a file.
    Tracks { file_id: FileId, index: usize },
    /// The segments of a track.
    Segments {
        file_id: FileId,
        trk_id: TrackId,
        index: usize,
    },
    /// The waypoints of a file.
    Waypoints { file_id: FileId, index: usize },
}

/// Moves elements to a place of the file tree (what drag and drop does), with their ids. The
/// moved elements are selected.
///
/// What can go where:
/// - files: among the files;
/// - tracks: among the files (each track becomes a file), or among the tracks of a file;
/// - segments: among the files (each segment becomes a file), among the tracks of a file (each
///   segment becomes a track), or among the segments of a track;
/// - waypoints, or all the waypoints of a file (the waypoints node): among the waypoints of a
///   file.
#[derive(Debug)]
pub struct Move {
    pub what: Selection,
    pub to: MoveTarget,
}

impl Apply for Move {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        use MoveTarget as To;
        let next = match (&self.what, self.to) {
            (Selection::File { file_ids }, To::Files { index }) => {
                transfer_files(state, file_ids, true, Place::Index(index))?
            }
            (Selection::Track { file_id, trk_ids }, To::Files { index }) => transfer_tracks(
                state,
                *file_id,
                trk_ids,
                true,
                TracksTo::Files(Place::Index(index)),
            )?,
            (Selection::Track { file_id, trk_ids }, To::Tracks { file_id: to, index }) => {
                transfer_tracks(
                    state,
                    *file_id,
                    trk_ids,
                    true,
                    TracksTo::File(to, Place::Index(index)),
                )?
            }
            (
                Selection::TrackSegment {
                    file_id,
                    trk_id,
                    trkseg_ids,
                },
                to,
            ) => {
                let to = match to {
                    To::Files { index } => SegmentsTo::Files(Place::Index(index)),
                    To::Tracks { file_id, index } => {
                        SegmentsTo::Tracks(file_id, Place::Index(index))
                    }
                    To::Segments {
                        file_id,
                        trk_id,
                        index,
                    } => SegmentsTo::Track(file_id, trk_id, Place::Index(index)),
                    To::Waypoints { .. } => return Err(CommandError::NothingToDo),
                };
                transfer_segments(state, *file_id, *trk_id, trkseg_ids, true, to)?
            }
            (Selection::Waypoints { file_id }, To::Waypoints { file_id: to, index }) => {
                transfer_waypoints(state, *file_id, None, true, to, Place::Index(index))?
            }
            (Selection::Waypoint { file_id, wpt_ids }, To::Waypoints { file_id: to, index }) => {
                transfer_waypoints(
                    state,
                    *file_id,
                    Some(wpt_ids),
                    true,
                    to,
                    Place::Index(index),
                )?
            }
            _ => return Err(CommandError::NothingToDo),
        };
        *state.selection = next;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{
        File, Track, TrackInfo, TrackSegment, TrackSegmentId, Waypoint, WaypointChunk, WaypointId,
        engine::command::fixture::Fixture, new_file, waypoint_ids,
    };

    use super::*;

    /// A file with the given tracks (name, number of segments) and number of waypoints.
    fn file(name: &str, tracks: &[(&str, usize)], waypoints: usize) -> File {
        let mut file = new_file(
            name,
            tracks
                .iter()
                .map(|(name, segments)| Track {
                    info: TrackInfo {
                        name: Some((*name).to_owned()),
                        ..Default::default()
                    },
                    trkseg: (0..*segments).map(|_| TrackSegment::default()).collect(),
                    ..Default::default()
                })
                .collect(),
        );
        if waypoints > 0 {
            file.wpt = vec![Rc::new(WaypointChunk {
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

    fn do_move(fx: &mut Fixture, what: Selection, to: MoveTarget) -> Result<(), CommandError> {
        Move { what, to }.apply(&mut fx.state())
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
    fn test_reorder_tracks_in_a_file() {
        let build = || {
            let mut fx = Fixture::default();
            let a = add(
                &mut fx,
                file("a", &[("0", 1), ("1", 1), ("2", 1), ("3", 1)], 0),
            );
            let t = track_ids(&fx, a);
            (fx, a, t)
        };
        let at = |a, index| MoveTarget::Tracks { file_id: a, index };

        // the position counts the tracks that stay
        let (mut fx, a, t) = build();
        do_move(&mut fx, tracks(a, &[t[0]]), at(a, 1)).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[1], t[0], t[2], t[3]]);
        assert_eq!(fx.selection, tracks(a, &[t[0]]));

        let (mut fx, a, t) = build();
        do_move(&mut fx, tracks(a, &[t[3]]), at(a, 0)).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[3], t[0], t[1], t[2]]);

        // several at once, as a block, in their order; past the end is the end
        let (mut fx, a, t) = build();
        do_move(&mut fx, tracks(a, &[t[1], t[0]]), at(a, 99)).unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[2], t[3], t[0], t[1]]);
        assert_eq!(fx.selection, tracks(a, &[t[0], t[1]]));
    }

    #[test]
    fn test_move_tracks_to_another_file_or_to_new_files() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[("t0", 1), ("t1", 1)], 0));
        let b = add(&mut fx, file("b", &[("b0", 1), ("b1", 1)], 0));
        let c = add(&mut fx, file("c", &[], 0));
        let t = track_ids(&fx, a);
        let b_tracks = track_ids(&fx, b);

        do_move(
            &mut fx,
            tracks(a, &[t[0]]),
            MoveTarget::Tracks {
                file_id: b,
                index: 1,
            },
        )
        .unwrap();
        assert_eq!(track_ids(&fx, a), vec![t[1]]);
        assert_eq!(track_ids(&fx, b), vec![b_tracks[0], t[0], b_tracks[1]]);
        assert_eq!(fx.selection, tracks(b, &[t[0]]));

        // as a new file, at a position of the list of files
        do_move(&mut fx, tracks(a, &[t[1]]), MoveTarget::Files { index: 1 }).unwrap();
        assert!(track_ids(&fx, a).is_empty());
        assert_eq!(fx.order.0.len(), 4);
        let new = fx.order.0[1];
        assert_eq!(fx.order.0[0], a);
        assert_eq!(fx.order.0[2..], [b, c]);
        assert_eq!(track_ids(&fx, new), vec![t[1]]);
        assert_eq!(fx.files[&new].info.name, "t1");
        assert_eq!(fx.selection, files(&[new]));
    }

    #[test]
    fn test_move_segments() {
        let build = || {
            let mut fx = Fixture::default();
            let a = add(&mut fx, file("a", &[("t0", 3), ("t1", 1)], 0));
            let t = track_ids(&fx, a);
            (fx, a, t)
        };

        // within a track
        let (mut fx, a, t) = build();
        let s = segment_ids(&fx, a, 0);
        do_move(
            &mut fx,
            segments(a, t[0], &[s[2]]),
            MoveTarget::Segments {
                file_id: a,
                trk_id: t[0],
                index: 0,
            },
        )
        .unwrap();
        assert_eq!(segment_ids(&fx, a, 0), vec![s[2], s[0], s[1]]);
        assert_eq!(fx.selection, segments(a, t[0], &[s[2]]));

        // to another track
        let (mut fx, a, t) = build();
        let s = segment_ids(&fx, a, 0);
        let other = segment_ids(&fx, a, 1);
        do_move(
            &mut fx,
            segments(a, t[0], &[s[0], s[1]]),
            MoveTarget::Segments {
                file_id: a,
                trk_id: t[1],
                index: 0,
            },
        )
        .unwrap();
        assert_eq!(segment_ids(&fx, a, 0), vec![s[2]]);
        assert_eq!(segment_ids(&fx, a, 1), vec![s[0], s[1], other[0]]);

        // as new tracks of a file
        let (mut fx, a, t) = build();
        let s = segment_ids(&fx, a, 0);
        do_move(
            &mut fx,
            segments(a, t[0], &[s[1]]),
            MoveTarget::Tracks {
                file_id: a,
                index: 1,
            },
        )
        .unwrap();
        assert_eq!(fx.files[&a].trk.len(), 3);
        assert_eq!(segment_ids(&fx, a, 1), vec![s[1]]);
        assert_eq!(segment_ids(&fx, a, 0), vec![s[0], s[2]]);
        assert_eq!(fx.files[&a].trk[0].id, t[0]);
        assert_eq!(fx.files[&a].trk[2].id, t[1]);

        // as new files
        let (mut fx, a, t) = build();
        let s = segment_ids(&fx, a, 0);
        do_move(
            &mut fx,
            segments(a, t[0], &[s[0], s[1]]),
            MoveTarget::Files { index: 0 },
        )
        .unwrap();
        assert_eq!(fx.order.0.len(), 3);
        assert_eq!(fx.order.0[2], a);
        assert_eq!(fx.files[&fx.order.0[0]].info.name, "t0");
        assert_eq!(segment_ids(&fx, a, 0), vec![s[2]]);
    }

    #[test]
    fn test_move_waypoints() {
        let build = || {
            let mut fx = Fixture::default();
            let a = add(&mut fx, file("a", &[], 4));
            let b = add(&mut fx, file("b", &[], 2));
            (fx, a, b)
        };
        let at = |file_id, index| MoveTarget::Waypoints { file_id, index };

        // within a file
        let (mut fx, a, _) = build();
        let w = wpt_ids(&fx, a);
        do_move(&mut fx, waypoints(a, &[w[3]]), at(a, 1)).unwrap();
        assert_eq!(wpt_ids(&fx, a), vec![w[0], w[3], w[1], w[2]]);
        assert_eq!(fx.selection, waypoints(a, &[w[3]]));

        // to the start of another file
        let (mut fx, a, b) = build();
        let w = wpt_ids(&fx, a);
        let before = wpt_ids(&fx, b);
        do_move(&mut fx, waypoints(a, &[w[0], w[1]]), at(b, 0)).unwrap();
        assert_eq!(wpt_ids(&fx, a), w[2..].to_vec());
        assert_eq!(wpt_ids(&fx, b), [&w[..2], &before[..]].concat());

        // all the waypoints of a file
        let (mut fx, a, b) = build();
        let w = wpt_ids(&fx, a);
        let before = wpt_ids(&fx, b);
        do_move(&mut fx, Selection::Waypoints { file_id: a }, at(b, 1)).unwrap();
        assert!(wpt_ids(&fx, a).is_empty());
        assert_eq!(
            wpt_ids(&fx, b),
            [&before[..1], &w[..], &before[1..]].concat()
        );
    }

    #[test]
    fn test_move_files() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[], 0));
        let b = add(&mut fx, file("b", &[], 0));
        let c = add(&mut fx, file("c", &[], 0));
        do_move(&mut fx, files(&[c]), MoveTarget::Files { index: 0 }).unwrap();
        assert_eq!(fx.order.0, vec![c, a, b]);
        do_move(&mut fx, files(&[c, a]), MoveTarget::Files { index: 1 }).unwrap();
        assert_eq!(fx.order.0, vec![b, c, a]);
        assert_eq!(fx.selection, files(&[c, a]));
    }

    #[test]
    fn test_what_cannot_be_moved() {
        let mut fx = Fixture::default();
        let a = add(&mut fx, file("a", &[("t", 1)], 1));
        let t = track_ids(&fx, a);
        let s = segment_ids(&fx, a, 0);
        let w = wpt_ids(&fx, a);
        let before = fx.files[&a].clone();
        let selection = fx.selection.clone();

        let invalid = [
            // the wrong kind of list
            (
                files(&[a]),
                MoveTarget::Tracks {
                    file_id: a,
                    index: 0,
                },
            ),
            (
                tracks(a, &t),
                MoveTarget::Waypoints {
                    file_id: a,
                    index: 0,
                },
            ),
            (
                tracks(a, &t),
                MoveTarget::Segments {
                    file_id: a,
                    trk_id: t[0],
                    index: 0,
                },
            ),
            (
                segments(a, t[0], &s),
                MoveTarget::Waypoints {
                    file_id: a,
                    index: 0,
                },
            ),
            (
                waypoints(a, &w),
                MoveTarget::Tracks {
                    file_id: a,
                    index: 0,
                },
            ),
            (waypoints(a, &w), MoveTarget::Files { index: 0 }),
            (
                Selection::Waypoints { file_id: a },
                MoveTarget::Files { index: 0 },
            ),
            (Selection::Empty, MoveTarget::Files { index: 0 }),
            // elements that do not exist
            (
                tracks(a, &[TrackId::default()]),
                MoveTarget::Files { index: 0 },
            ),
            (
                waypoints(a, &[WaypointId::default()]),
                MoveTarget::Waypoints {
                    file_id: a,
                    index: 0,
                },
            ),
            (files(&[FileId::default()]), MoveTarget::Files { index: 0 }),
            // a place that does not exist
            (
                tracks(a, &t),
                MoveTarget::Tracks {
                    file_id: FileId::default(),
                    index: 0,
                },
            ),
            (
                segments(a, t[0], &s),
                MoveTarget::Segments {
                    file_id: a,
                    trk_id: TrackId::default(),
                    index: 0,
                },
            ),
            (
                waypoints(a, &w),
                MoveTarget::Waypoints {
                    file_id: FileId::default(),
                    index: 0,
                },
            ),
        ];
        for (what, to) in invalid {
            assert_eq!(
                do_move(&mut fx, what.clone(), to),
                Err(CommandError::NothingToDo),
                "{what:?} to {to:?}"
            );
            // nothing changed
            assert!(Rc::ptr_eq(&fx.files[&a], &before));
            assert_eq!(fx.order.0, vec![a]);
            assert_eq!(fx.selection, selection);
        }
    }
}
