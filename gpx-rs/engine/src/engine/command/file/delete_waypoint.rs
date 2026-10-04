use crate::{Apply, CommandError, FileId, Selection, State, WaypointId, delete_waypoints};

/// Deletes a waypoint of a file, whatever is selected (what the delete button of its popup does).
/// If it was the only selected element, its file gets selected.
#[derive(Debug)]
pub struct DeleteWaypoint {
    pub file_id: FileId,
    pub waypoint_id: WaypointId,
}

impl Apply for DeleteWaypoint {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        delete_waypoints(state.files, self.file_id, |wpt| wpt.id == self.waypoint_id)?;
        if let Selection::Waypoint { file_id, wpt_ids } = &*state.selection
            && *file_id == self.file_id
            && wpt_ids.iter().all(|id| *id == self.waypoint_id)
        {
            *state.selection = Selection::File {
                file_ids: [self.file_id].into(),
            };
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{
        File, Selection, Waypoint, WaypointChunk, engine::command::fixture::Fixture, waypoint_ids,
    };

    use super::*;

    #[test]
    fn test_deletes_one_waypoint_without_touching_the_selection() {
        let mut fx = Fixture::default();
        let mut file = File::default();
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: (0..3)
                .map(|i| Waypoint {
                    name: Some(format!("w{i}")),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        }));
        let id = file.id;
        let ids: Vec<_> = waypoint_ids(&file).collect();
        fx.files.insert(id, Rc::new(file));
        fx.order.0.push(id);
        fx.selection = Selection::File {
            file_ids: [id].into(),
        };

        DeleteWaypoint {
            file_id: id,
            waypoint_id: ids[1],
        }
        .apply(&mut fx.state())
        .unwrap();

        let names: Vec<_> = fx.files[&id]
            .wpt
            .iter()
            .flat_map(|chunk| &chunk.wpt)
            .map(|wpt| wpt.name.clone().unwrap())
            .collect();
        assert_eq!(names, ["w0", "w2"]);
        assert_eq!(
            fx.selection,
            Selection::File {
                file_ids: [id].into()
            }
        );
    }

    #[test]
    fn test_deleting_the_selected_waypoint_selects_its_file() {
        let mut fx = Fixture::default();
        let mut file = File::default();
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: vec![Waypoint::default(), Waypoint::default()],
            ..Default::default()
        }));
        let id = file.id;
        let ids: Vec<_> = waypoint_ids(&file).collect();
        fx.files.insert(id, Rc::new(file));
        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: [ids[0]].into(),
        };
        DeleteWaypoint {
            file_id: id,
            waypoint_id: ids[0],
        }
        .apply(&mut fx.state())
        .unwrap();
        assert_eq!(
            fx.selection,
            Selection::File {
                file_ids: [id].into()
            }
        );
    }

    #[test]
    fn test_unknown_waypoint_is_nothing_to_do() {
        let mut fx = Fixture::default();
        let file = File::default();
        let id = file.id;
        fx.files.insert(id, Rc::new(file));
        let result = DeleteWaypoint {
            file_id: id,
            waypoint_id: WaypointId::default(),
        }
        .apply(&mut fx.state());
        assert!(matches!(result, Err(CommandError::NothingToDo)));
    }
}
