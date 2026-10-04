use std::rc::Rc;

use crate::{
    Apply, CommandError, FileId, Selection, StackEntry, State, Waypoint, edit_waypoint_chunks,
};

/// Deletes the selected elements. With `whole_files`, the files holding the selected elements
/// are deleted instead, even if only a track or a waypoint is selected.
#[derive(Debug)]
pub struct Delete {
    pub whole_files: bool,
}

impl Apply for Delete {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let files = state.selection.to_files();
        let selection = if self.whole_files {
            &files
        } else {
            &*state.selection
        };
        let next = match selection {
            Selection::File { file_ids } => {
                state.files.retain(|id, _| !file_ids.contains(id));
                state.order.0.retain(|id| !file_ids.contains(id));
                Selection::Empty
            }
            Selection::Track { file_id, trk_ids } => {
                let file = state
                    .files
                    .get_mut(file_id)
                    .ok_or(CommandError::NothingToDo)?;
                let file = Rc::make_mut(file);
                let len = file.trk.len();
                file.trk.retain(|trk| !trk_ids.contains(&trk.id));
                if file.trk.len() == len {
                    return Err(CommandError::NothingToDo);
                }
                Selection::File {
                    file_ids: [*file_id].into(),
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
                let len = trk.trkseg.len();
                trk.trkseg.retain(|seg| !trkseg_ids.contains(&seg.id));
                if trk.trkseg.len() == len {
                    return Err(CommandError::NothingToDo);
                }
                Selection::Track {
                    file_id: *file_id,
                    trk_ids: [*trk_id].into(),
                }
            }
            Selection::Waypoints { file_id } => delete_waypoints(state.files, *file_id, |_| true)?,
            Selection::Waypoint { file_id, wpt_ids } => {
                delete_waypoints(state.files, *file_id, |wpt| wpt_ids.contains(&wpt.id))?
            }
            Selection::Empty => return Err(CommandError::NothingToDo),
        };
        *state.selection = next;
        Ok(())
    }
}

pub(crate) fn delete_waypoints(
    files: &mut StackEntry,
    file_id: FileId,
    filter: impl Fn(&Waypoint) -> bool,
) -> Result<Selection, CommandError> {
    let file = files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let mut file = (**file).clone();
    let changed = edit_waypoint_chunks(&mut file, &filter, |wpts| {
        wpts.retain(|wpt| !filter(wpt));
        true
    });
    if !changed {
        return Err(CommandError::NothingToDo);
    }
    files.insert(file_id, Rc::new(file));
    Ok(Selection::File {
        file_ids: [file_id].into(),
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

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
    fn test_delete_nothing_selected() {
        let mut fx = Fixture::default();
        assert_eq!(
            Delete { whole_files: false }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_delete_selected_files() {
        let (mut fx, id) = loaded();
        crate::New { name: "keep" }.apply(&mut fx.state()).unwrap();
        let keep = fx.order.0[1];
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        Delete { whole_files: false }
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(fx.order.0, vec![keep]);
        assert!(fx.files.contains_key(&keep) && !fx.files.contains_key(&id));
        assert!(matches!(fx.selection, Selection::Empty));
    }

    #[test]
    fn test_delete_selected_tracks() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].trk.len();
        let trk_id = fx.files[&id].trk[0].id;
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([trk_id]),
        };
        Delete { whole_files: false }
            .apply(&mut fx.state())
            .unwrap();
        let file = &fx.files[&id];
        assert_eq!(file.trk.len(), before - 1);
        assert!(file.trk.iter().all(|t| t.id != trk_id));
        assert_eq!(fx.selected_files(), HashSet::from([id]));
    }

    #[test]
    fn test_delete_selected_segments() {
        let (mut fx, id) = loaded();
        let trk = &fx.files[&id].trk[0];
        let (trk_id, seg_id, before) = (trk.id, trk.trkseg[0].id, trk.trkseg.len());
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id,
            trkseg_ids: HashSet::from([seg_id]),
        };
        Delete { whole_files: false }
            .apply(&mut fx.state())
            .unwrap();
        let trk = &fx.files[&id].trk[0];
        assert_eq!(trk.trkseg.len(), before - 1);
        assert!(trk.trkseg.iter().all(|s| s.id != seg_id));
        assert!(
            matches!(&fx.selection, Selection::Track { trk_ids, .. } if trk_ids.contains(&trk_id))
        );
    }

    fn with_waypoints(fx: &mut Fixture, id: FileId, n: usize) -> Vec<crate::WaypointId> {
        let wpts: Vec<_> = (0..n).map(|_| Waypoint::default()).collect();
        let ids = wpts.iter().map(|w| w.id).collect();
        let mut file = (*fx.files[&id]).clone();
        file.wpt = vec![Rc::new(crate::WaypointChunk {
            wpt: wpts,
            ..Default::default()
        })];
        fx.files.insert(id, Rc::new(file));
        ids
    }

    #[test]
    fn test_delete_selected_waypoints() {
        let (mut fx, id) = loaded();
        let ids = with_waypoints(&mut fx, id, 3);
        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([ids[1]]),
        };
        let rev = fx.files[&id].wpt_rev_id;
        Delete { whole_files: false }
            .apply(&mut fx.state())
            .unwrap();
        assert_ne!(fx.files[&id].wpt_rev_id, rev);
        let left: Vec<_> = fx.files[&id]
            .wpt
            .iter()
            .flat_map(|c| c.wpt.iter().map(|w| w.id))
            .collect();
        assert_eq!(left, vec![ids[0], ids[2]]);
        assert_eq!(fx.selected_files(), HashSet::from([id]));
    }

    #[test]
    fn test_delete_all_waypoints_of_file() {
        let (mut fx, id) = loaded();
        with_waypoints(&mut fx, id, 3);
        fx.selection = Selection::Waypoints { file_id: id };
        Delete { whole_files: false }
            .apply(&mut fx.state())
            .unwrap();
        assert!(fx.files[&id].wpt.is_empty());
        fx.selection = Selection::Waypoints { file_id: id };
        assert_eq!(
            Delete { whole_files: false }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_delete_unknown_ids_is_nothing_to_do() {
        let (mut fx, id) = loaded();
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([Default::default()]),
        };
        assert_eq!(
            Delete { whole_files: false }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_delete_whole_files_of_the_selected_elements() {
        for selection in [
            |id: FileId, fx: &Fixture| Selection::Track {
                file_id: id,
                trk_ids: HashSet::from([fx.files[&id].trk[0].id]),
            },
            |id: FileId, fx: &Fixture| Selection::TrackSegment {
                file_id: id,
                trk_id: fx.files[&id].trk[0].id,
                trkseg_ids: HashSet::from([fx.files[&id].trk[0].trkseg[0].id]),
            },
            |id: FileId, _: &Fixture| Selection::Waypoints { file_id: id },
            |id: FileId, _: &Fixture| Selection::File {
                file_ids: HashSet::from([id]),
            },
        ] {
            let (mut fx, id) = loaded();
            crate::New { name: "keep" }.apply(&mut fx.state()).unwrap();
            let keep = fx.order.0[1];
            fx.selection = selection(id, &fx);
            Delete { whole_files: true }.apply(&mut fx.state()).unwrap();
            assert_eq!(fx.order.0, vec![keep]);
            assert!(!fx.files.contains_key(&id));
            assert!(matches!(fx.selection, Selection::Empty));
        }
    }

    #[test]
    fn test_delete_whole_files_nothing_selected() {
        let mut fx = Fixture::default();
        assert_eq!(
            Delete { whole_files: true }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
}
