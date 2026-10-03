use std::rc::Rc;

use crate::{
    File, FileId, Selection, StackEntry, State, Track, TrackSegment, Waypoint, edit_waypoint_chunks,
};

/// What an [`Editor`] hook did to the element it was given.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Edit {
    Unchanged,
    Changed,
}

impl Edit {
    fn merge(self, other: Edit) -> Edit {
        if self == Edit::Changed || other == Edit::Changed {
            Edit::Changed
        } else {
            Edit::Unchanged
        }
    }
}

/// Independent edit of each selected element, without needing the rest of the state.
///
/// A selected file, track or segment is passed to the hook of its own level. By default a
/// file is forwarded to its tracks and a track to its segments, so an editor only overrides
/// the level(s) it cares about (metadata: file and track, style: track, reverse: segment).
/// Waypoints are only edited when selected, never through their file.
pub trait Editor {
    fn file(&mut self, file: &mut File) -> Edit {
        edit_each(&mut file.trk, |trk| self.track(trk))
    }

    fn track(&mut self, track: &mut Track) -> Edit {
        edit_each(&mut track.trkseg, |seg| edit_segment(self, seg))
    }

    fn segment(&mut self, _segment: &mut TrackSegment) -> Edit {
        Edit::Unchanged
    }

    fn waypoint(&mut self, _waypoint: &mut Waypoint) -> Edit {
        Edit::Unchanged
    }
}

/// Calls the segment hook and gives the segment a new revision id if it changed, so that
/// derived data (statistics) is recomputed.
fn edit_segment<E: Editor + ?Sized>(editor: &mut E, segment: &mut TrackSegment) -> Edit {
    let edit = editor.segment(segment);
    if edit == Edit::Changed {
        segment.rev_id = Default::default();
    }
    edit
}

fn edit_each<T>(items: &mut [T], f: impl FnMut(&mut T) -> Edit) -> Edit {
    edit_where(items, |_| true, f)
}

fn edit_where<T>(
    items: &mut [T],
    filter: impl Fn(&T) -> bool,
    mut f: impl FnMut(&mut T) -> Edit,
) -> Edit {
    items
        .iter_mut()
        .filter(|item| filter(item))
        .fold(Edit::Unchanged, |acc, item| acc.merge(f(item)))
}

/// Edits a copy of the file (cheap, track points are shared chunks) and stores it back as a
/// new snapshot only if something changed.
fn update_file(files: &mut StackEntry, id: FileId, f: impl FnOnce(&mut File) -> Edit) {
    let Some(current) = files.get(&id) else {
        return;
    };
    let mut file = (**current).clone();
    if f(&mut file) == Edit::Changed {
        files.insert(id, Rc::new(file));
    }
}

fn edit_waypoints<E: Editor + ?Sized>(
    file: &mut File,
    filter: impl Fn(&Waypoint) -> bool,
    editor: &mut E,
) -> Edit {
    let changed = edit_waypoint_chunks(file, &filter, |wpts| {
        edit_where(wpts, &filter, |wpt| editor.waypoint(wpt)) == Edit::Changed
    });
    if changed {
        Edit::Changed
    } else {
        Edit::Unchanged
    }
}

/// Applies the editor to every selected file, track or segment.
pub fn update_selected<E: Editor>(state: &mut State, editor: &mut E) {
    match &*state.selection {
        Selection::File { file_ids } => {
            for id in file_ids {
                update_file(state.files, *id, |file| editor.file(file));
            }
        }
        Selection::Track { file_id, trk_ids } => {
            update_file(state.files, *file_id, |file| {
                edit_where(
                    &mut file.trk,
                    |trk| trk_ids.contains(&trk.id),
                    |trk| editor.track(trk),
                )
            });
        }
        Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            update_file(state.files, *file_id, |file| {
                edit_where(
                    &mut file.trk,
                    |trk| trk.id == *trk_id,
                    |trk| {
                        edit_where(
                            &mut trk.trkseg,
                            |seg| trkseg_ids.contains(&seg.id),
                            |seg| edit_segment(editor, seg),
                        )
                    },
                )
            });
        }
        Selection::Waypoints { file_id } => {
            update_file(state.files, *file_id, |file| {
                edit_waypoints(file, |_| true, editor)
            });
        }
        Selection::Waypoint { file_id, wpt_ids } => {
            update_file(state.files, *file_id, |file| {
                edit_waypoints(file, |wpt| wpt_ids.contains(&wpt.id), editor)
            });
        }
        Selection::Empty => {}
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::engine::command::fixture::Fixture;

    use super::*;

    struct Rename;

    impl Editor for Rename {
        fn file(&mut self, file: &mut File) -> Edit {
            file.info.name.push('!');
            Edit::Changed
        }

        fn track(&mut self, track: &mut Track) -> Edit {
            track.info.name = Some("track".to_string());
            Edit::Changed
        }

        fn segment(&mut self, _: &mut TrackSegment) -> Edit {
            Edit::Changed
        }
    }

    struct Nothing;
    impl Editor for Nothing {}

    fn fixture_with_tracks() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        let file = Rc::new(crate::parse(&data).unwrap());
        let id = file.id;
        fx.files.insert(id, file);
        (fx, id)
    }

    #[test]
    fn test_only_selected_files_are_updated() {
        let mut fx = Fixture::default();
        let (a, b, c) = (File::default(), File::default(), File::default());
        let ids = [a.id, b.id, c.id];
        for file in [a, b, c] {
            fx.files.insert(file.id, Rc::new(file));
        }
        let untouched = fx.files[&ids[2]].clone();
        fx.selection = Selection::File {
            file_ids: HashSet::from([ids[0], ids[1]]),
        };

        update_selected(&mut fx.state(), &mut Rename);

        assert_eq!(fx.files[&ids[0]].info.name, "!");
        assert_eq!(fx.files[&ids[1]].info.name, "!");
        assert!(Rc::ptr_eq(&fx.files[&ids[2]], &untouched));
    }

    #[test]
    fn test_unchanged_file_keeps_its_snapshot() {
        let (mut fx, id) = fixture_with_tracks();
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        let before = fx.files[&id].clone();
        update_selected(&mut fx.state(), &mut Nothing);
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }

    #[test]
    fn test_track_selection_uses_track_hook() {
        let (mut fx, id) = fixture_with_tracks();
        let trk_id = fx.files[&id].trk[0].id;
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([trk_id]),
        };
        update_selected(&mut fx.state(), &mut Rename);

        let file = &fx.files[&id];
        assert_eq!(file.info.name, "with_tracks_and_segments");
        assert_eq!(file.trk[0].info.name.as_deref(), Some("track"));
        assert_ne!(file.trk[1].info.name.as_deref(), Some("track"));
    }

    #[test]
    fn test_segment_selection_bumps_revision_id() {
        let (mut fx, id) = fixture_with_tracks();
        let before = fx.files[&id].clone();
        let trk = &before.trk[0];
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trk.trkseg[0].id]),
        };
        update_selected(&mut fx.state(), &mut Rename);

        let after = &fx.files[&id];
        assert_ne!(after.trk[0].trkseg[0].rev_id, trk.trkseg[0].rev_id);
        assert_eq!(after.trk[0].trkseg[1].rev_id, trk.trkseg[1].rev_id);
        assert_eq!(
            after.trk[1].trkseg[0].rev_id,
            before.trk[1].trkseg[0].rev_id
        );
    }

    #[test]
    fn test_file_selection_cascades_to_segments() {
        struct SegmentsOnly;
        impl Editor for SegmentsOnly {
            fn segment(&mut self, _: &mut TrackSegment) -> Edit {
                Edit::Changed
            }
        }
        let (mut fx, id) = fixture_with_tracks();
        let before = fx.files[&id].clone();
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        update_selected(&mut fx.state(), &mut SegmentsOnly);
        for (b, a) in before.trk.iter().zip(fx.files[&id].trk.iter()) {
            for (b, a) in b.trkseg.iter().zip(a.trkseg.iter()) {
                assert_ne!(b.rev_id, a.rev_id);
            }
        }
    }

    #[test]
    fn test_waypoint_selection_edits_only_selected_waypoints() {
        struct Name;
        impl Editor for Name {
            fn waypoint(&mut self, wpt: &mut Waypoint) -> Edit {
                wpt.name = Some("x".into());
                Edit::Changed
            }
        }
        let (mut fx, id) = fixture_with_tracks();
        let wpts: Vec<_> = (0..3).map(|_| Waypoint::default()).collect();
        let ids: Vec<_> = wpts.iter().map(|w| w.id).collect();
        let mut file = (*fx.files[&id]).clone();
        file.wpt = vec![Rc::new(crate::WaypointChunk {
            wpt: wpts,
            ..Default::default()
        })];
        fx.files.insert(id, Rc::new(file));
        let chunk_id = fx.files[&id].wpt[0].id;

        // A file selection never touches waypoints.
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        update_selected(&mut fx.state(), &mut Name);
        assert!(fx.files[&id].wpt[0].wpt.iter().all(|w| w.name.is_none()));

        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([ids[1]]),
        };
        let rev = fx.files[&id].wpt_rev_id;
        update_selected(&mut fx.state(), &mut Name);
        assert_ne!(fx.files[&id].wpt_rev_id, rev);
        let chunk = &fx.files[&id].wpt[0];
        assert_ne!(chunk.id, chunk_id);
        let named: Vec<_> = chunk.wpt.iter().map(|w| w.name.is_some()).collect();
        assert_eq!(named, [false, true, false]);

        fx.selection = Selection::Waypoints { file_id: id };
        update_selected(&mut fx.state(), &mut Name);
        assert!(fx.files[&id].wpt[0].wpt.iter().all(|w| w.name.is_some()));
    }

    #[test]
    fn test_missing_files_and_other_selections_are_ignored() {
        let mut fx = Fixture::default();
        let file = File::default();
        let id = file.id;
        fx.files.insert(id, Rc::new(file));
        let before = fx.files[&id].clone();

        for selection in [
            Selection::File {
                file_ids: HashSet::from([FileId::default()]),
            },
            Selection::Empty,
        ] {
            fx.selection = selection;
            update_selected(&mut fx.state(), &mut Rename);
            assert!(Rc::ptr_eq(&fx.files[&id], &before));
        }
    }
}
