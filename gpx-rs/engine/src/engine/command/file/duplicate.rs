use std::{collections::HashSet, rc::Rc};

use crate::{
    Apply, CommandError, FileId, Selection, StackEntry, State, Waypoint, copy_file, copy_segment,
    copy_track, copy_waypoint,
};

#[derive(Debug)]
pub struct Duplicate;

impl Apply for Duplicate {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let next = match &*state.selection {
            Selection::File { file_ids } => {
                let mut copies = HashSet::new();
                let mut order = Vec::new();
                for id in state.order.0.iter().filter(|id| file_ids.contains(id)) {
                    let Some(file) = state.files.get(id) else {
                        continue;
                    };
                    let copy = copy_file(file);
                    order.push(copy.id);
                    copies.insert(copy.id);
                    state.files.insert(copy.id, Rc::new(copy));
                }
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                let at = state
                    .order
                    .0
                    .iter()
                    .rposition(|id| file_ids.contains(id))
                    .map_or(state.order.0.len(), |i| i + 1);
                state.order.0.splice(at..at, order);
                Selection::File { file_ids: copies }
            }
            Selection::Track { file_id, trk_ids } => {
                let file = state
                    .files
                    .get_mut(file_id)
                    .ok_or(CommandError::NothingToDo)?;
                let file = Rc::make_mut(file);
                let mut copies = HashSet::new();
                append_copies(
                    &mut file.trk,
                    |trk| trk_ids.contains(&trk.id),
                    |trk| {
                        let copy = copy_track(trk);
                        copies.insert(copy.id);
                        copy
                    },
                );
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                Selection::Track {
                    file_id: *file_id,
                    trk_ids: copies,
                }
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => {
                let file = state
                    .files
                    .get_mut(file_id)
                    .ok_or(CommandError::NothingToDo)?;
                let file = Rc::make_mut(file);
                let trk = file
                    .trk
                    .iter_mut()
                    .find(|trk| trk.id == *trk_id)
                    .ok_or(CommandError::NothingToDo)?;
                let mut copies = HashSet::new();
                append_copies(
                    &mut trk.trkseg,
                    |seg| trkseg_ids.contains(&seg.id),
                    |seg| {
                        let copy = copy_segment(seg);
                        copies.insert(copy.id);
                        copy
                    },
                );
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                Selection::TrackSegment {
                    file_id: *file_id,
                    trk_id: *trk_id,
                    trkseg_ids: copies,
                }
            }
            Selection::Waypoints { file_id } => {
                duplicate_waypoints(state.files, *file_id, |_| true)?
            }
            Selection::Waypoint { file_id, wpt_ids } => {
                duplicate_waypoints(state.files, *file_id, |wpt| wpt_ids.contains(&wpt.id))?
            }
            Selection::Empty => return Err(CommandError::NothingToDo),
        };
        *state.selection = next;
        Ok(())
    }
}

fn duplicate_waypoints(
    files: &mut StackEntry,
    file_id: FileId,
    filter: impl Fn(&Waypoint) -> bool,
) -> Result<Selection, CommandError> {
    let file = files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let selected: Vec<&Waypoint> = file.wpt.iter().filter(|wpt| filter(wpt)).collect();
    let last = selected.last().ok_or(CommandError::NothingToDo)?.id;
    let copies: Vec<Waypoint> = selected.into_iter().map(copy_waypoint).collect();
    let copy_ids = copies.iter().map(|wpt| wpt.id).collect();

    // The copies go right after the last selected waypoint.
    let mut file = (**file).clone();
    file.wpt.insert_after(Some(last), copies);
    files.insert(file_id, Rc::new(file));
    Ok(Selection::Waypoint {
        file_id,
        wpt_ids: copy_ids,
    })
}

/// Inserts a copy of each item matching `filter`, as a block after the last matching item.
fn append_copies<T>(items: &mut Vec<T>, filter: impl Fn(&T) -> bool, copy: impl FnMut(&T) -> T) {
    let Some(last) = items.iter().rposition(&filter) else {
        return;
    };
    let copies: Vec<T> = items.iter().filter(|item| filter(item)).map(copy).collect();
    items.splice(last + 1..last + 1, copies);
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;
    use crate::{FileId, Load};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = fx.order.0[0];
        (fx, id)
    }

    #[test]
    fn test_duplicate_nothing_selected() {
        let mut fx = Fixture::default();
        assert_eq!(
            Duplicate.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_duplicate_file() {
        let (mut fx, id) = loaded();
        Duplicate.apply(&mut fx.state()).unwrap();
        assert_eq!(fx.files.len(), 2);
        let copy_id = fx.order.0[1];
        assert_eq!(fx.selected_files(), [copy_id].into());
        let (orig, copy) = (&fx.files[&id], &fx.files[&copy_id]);
        assert_ne!(copy_id, id);
        assert_eq!(copy.info.name, orig.info.name);
        assert_eq!(copy.trk.len(), orig.trk.len());
        for (a, b) in orig.trk.iter().zip(&copy.trk) {
            assert_ne!(a.id, b.id);
            assert_eq!(a.info, b.info);
            for (a, b) in a.trkseg.iter().zip(&b.trkseg) {
                assert_ne!(a.id, b.id);
                assert_eq!(a.len(), b.len());
            }
        }
    }

    #[test]
    fn test_duplicate_files_go_after_last_selected() {
        let mut fx = Fixture::default();
        for name in ["a", "b", "c"] {
            crate::New {
                name,
                trackpoint: None,
            }
            .apply(&mut fx.state())
            .unwrap();
        }
        let [a, b, c] = [fx.order.0[0], fx.order.0[1], fx.order.0[2]];
        fx.selection = Selection::File {
            file_ids: [a, b].into(),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        assert_eq!(fx.order.0.len(), 5);
        assert_eq!(fx.order.0[..2], [a, b]);
        assert_eq!(fx.order.0[4], c);
        assert_eq!(
            fx.selected_files(),
            fx.order.0[2..4].iter().copied().collect()
        );
    }

    #[test]
    fn test_duplicate_track_appends_copy() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].trk.len();
        let (trk_id, second_id) = (fx.files[&id].trk[0].id, fx.files[&id].trk[1].id);
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [trk_id].into(),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        let file = &fx.files[&id];
        assert_eq!(file.trk.len(), before + 1);
        assert_eq!(file.trk[0].id, trk_id);
        assert_ne!(file.trk[1].id, trk_id);
        // copies go right after the selected track, not at the end
        assert_eq!(file.trk[2].id, second_id);
        assert!(
            matches!(&fx.selection, Selection::Track { trk_ids, .. } if trk_ids.contains(&file.trk[1].id))
        );
    }

    #[test]
    fn test_duplicate_selected_waypoints() {
        let (mut fx, id) = loaded();
        let wpts: Vec<_> = (0..3).map(|_| Waypoint::default()).collect();
        let ids: Vec<_> = wpts.iter().map(|w| w.id).collect();
        let mut file = (*fx.files[&id]).clone();
        file.wpt = crate::Waypoints::new([crate::WaypointChunk {
            wpt: wpts,
            ..Default::default()
        }]);
        fx.files.insert(id, Rc::new(file));
        let original_chunk = fx.files[&id].wpt.chunks()[0].clone();

        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([ids[0]]),
        };
        let rev = fx.files[&id].wpt.rev_id;
        Duplicate.apply(&mut fx.state()).unwrap();
        assert_ne!(fx.files[&id].wpt.rev_id, rev);
        let all: Vec<_> = fx.files[&id].wpt.iter().map(|w| w.id).collect();
        assert_eq!(all.len(), 4);
        assert!(
            matches!(&fx.selection, Selection::Waypoint { wpt_ids, .. } if wpt_ids == &HashSet::from([all[1]]))
        );
        // the copy comes right after the selected waypoint, in a new chunk
        assert_eq!(all[..], [ids[0], all[1], ids[1], ids[2]]);
        assert_eq!(fx.files[&id].wpt.chunks().len(), 1);
        assert_ne!(fx.files[&id].wpt.chunks()[0].id, original_chunk.id);

        // selecting the last waypoint: the copy goes at the end
        let last = fx.files[&id].wpt.iter().last().unwrap().id;
        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([last]),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        let all: Vec<_> = fx.files[&id].wpt.iter().map(|w| w.id).collect();
        assert_eq!(all.len(), 5);
        assert_eq!(all[..4], [ids[0], all[1], ids[1], ids[2]]);

        fx.selection = Selection::Waypoints { file_id: id };
        Duplicate.apply(&mut fx.state()).unwrap();
        assert_eq!(fx.files[&id].wpt.len(), 10);
    }

    #[test]
    fn test_duplicate_segment_appends_copy() {
        let (mut fx, id) = loaded();
        let trk = &fx.files[&id].trk[0];
        let (trk_id, seg_id, before) = (trk.id, trk.trkseg[0].id, trk.trkseg.len());
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id,
            trkseg_ids: [seg_id].into(),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        let trk = &fx.files[&id].trk[0];
        assert_eq!(trk.trkseg.len(), before + 1);
        assert_eq!(trk.trkseg[0].id, seg_id);
        assert_ne!(trk.trkseg[1].id, seg_id);
        assert_eq!(trk.trkseg[0].len(), trk.trkseg[1].len());
    }
}
