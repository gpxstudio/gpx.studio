use std::rc::Rc;

use crate::{Apply, CommandError, Selection, State};

#[derive(Debug)]
pub struct Delete;

impl Apply for Delete {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let next = match &*state.selection {
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
            // TODO waypoints
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => {
                return Err(CommandError::NothingToDo);
            }
        };
        *state.selection = next;
        Ok(())
    }
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
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let id = fx.order.0[0];
        (fx, id)
    }

    #[test]
    fn test_delete_nothing_selected() {
        let mut fx = Fixture::default();
        assert_eq!(
            Delete.apply(&mut fx.state()),
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
        Delete.apply(&mut fx.state()).unwrap();
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
        Delete.apply(&mut fx.state()).unwrap();
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
        Delete.apply(&mut fx.state()).unwrap();
        let trk = &fx.files[&id].trk[0];
        assert_eq!(trk.trkseg.len(), before - 1);
        assert!(trk.trkseg.iter().all(|s| s.id != seg_id));
        assert!(
            matches!(&fx.selection, Selection::Track { trk_ids, .. } if trk_ids.contains(&trk_id))
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
            Delete.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
}
