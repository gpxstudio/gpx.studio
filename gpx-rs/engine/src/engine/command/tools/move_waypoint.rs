use crate::{Apply, CommandError, FileId, LngLat, State, WaypointId, update_waypoint};

/// Moves a waypoint of a file, whatever is selected (what a drag does): only its position and
/// elevation change.
#[derive(Debug)]
pub struct MoveWaypoint {
    pub file_id: FileId,
    pub waypoint_id: WaypointId,
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
}

impl Apply for MoveWaypoint {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        update_waypoint(state, self.file_id, self.waypoint_id, |wpt| {
            wpt.coordinates = LngLat {
                lng: self.lng,
                lat: self.lat,
            };
            wpt.ele = self.ele;
        })
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{
        File, Selection, Waypoint, WaypointChunk, engine::command::fixture::Fixture, waypoint_ids,
    };

    use super::*;

    fn fixture() -> (Fixture, crate::FileId, Vec<crate::WaypointId>) {
        let mut fx = Fixture::default();
        let mut file = File::default();
        file.wpt.push(WaypointChunk {
            wpt: (0..3)
                .map(|i| Waypoint {
                    name: Some(format!("w{i}")),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        });
        let id = file.id;
        let ids = waypoint_ids(&file).collect();
        fx.files.insert(id, Rc::new(file));
        fx.order.0.push(id);
        (fx, id, ids)
    }

    #[test]
    fn test_only_the_given_waypoint_moves_whatever_is_selected() {
        let (mut fx, id, ids) = fixture();
        let rev = fx.files[&id].wpt.rev_id;

        MoveWaypoint {
            file_id: id,
            waypoint_id: ids[1],
            lng: 4.0,
            lat: 50.0,
            ele: 42.0,
        }
        .apply(&mut fx.state())
        .unwrap();

        let wpts: Vec<_> = fx.files[&id].wpt.iter().collect();
        assert_eq!(wpts.len(), 3);
        assert_eq!(
            (
                wpts[1].coordinates.lng,
                wpts[1].coordinates.lat,
                wpts[1].ele
            ),
            (4.0, 50.0, 42.0)
        );
        // the other fields and the other waypoints are as they were
        assert_eq!(wpts[1].name.as_deref(), Some("w1"));
        assert_eq!(wpts[1].id, ids[1]);
        assert_eq!((wpts[0].coordinates.lng, wpts[0].ele), (0.0, 0.0));
        assert_eq!((wpts[2].coordinates.lat, wpts[2].ele), (0.0, 0.0));
        // the coordinates changed, which is noticed by what is derived from them
        assert_ne!(fx.files[&id].wpt.rev_id, rev);
        assert_eq!(fx.selection, Selection::Empty);
    }

    #[test]
    fn test_unknown_waypoint_or_file_is_nothing_to_do() {
        let (mut fx, id, ids) = fixture();
        let before = fx.files[&id].clone();
        for (file_id, waypoint_id) in [(id, WaypointId::default()), (FileId::default(), ids[0])] {
            let result = MoveWaypoint {
                file_id,
                waypoint_id,
                lng: 1.0,
                lat: 1.0,
                ele: 1.0,
            }
            .apply(&mut fx.state());
            assert!(matches!(result, Err(CommandError::NothingToDo)));
        }
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
