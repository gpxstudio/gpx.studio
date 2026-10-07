use std::rc::Rc;

use crate::{
    Apply, CommandError, File, FileId, Link, LngLat, Selection, State, Waypoint,
    insert_waypoints_at,
};

/// Adds a waypoint at the end of the waypoints of each selected file (or of the file of the
/// selected elements). The strings are empty when the waypoint does not have the field.
#[derive(Debug)]
pub struct NewWaypoint<'a> {
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
    pub name: &'a str,
    pub desc: &'a str,
    pub icon: &'a str,
    pub link: &'a str,
}

fn non_empty(text: &str) -> Option<String> {
    (!text.is_empty()).then(|| text.to_owned())
}

/// Sets the fields of a waypoint: the strings that are empty remove the field.
pub fn set_waypoint_fields(
    waypoint: &mut Waypoint,
    position: (f64, f64, f64),
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) {
    let (lng, lat, ele) = position;
    waypoint.coordinates = LngLat { lng, lat };
    waypoint.ele = ele;
    waypoint.name = non_empty(name);
    waypoint.desc = non_empty(desc);
    // the description is also the comment, as it is what the other applications show
    waypoint.cmt = non_empty(desc);
    waypoint.sym = non_empty(icon);
    waypoint.link = non_empty(link).map(|href| Link { href, text: None });
}

impl Apply for NewWaypoint<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let file_ids: Vec<FileId> = match &*state.selection {
            Selection::Empty => vec![],
            Selection::File { file_ids } => state
                .order
                .0
                .iter()
                .filter(|id| file_ids.contains(id))
                .copied()
                .collect(),
            Selection::Track { file_id, .. }
            | Selection::TrackSegment { file_id, .. }
            | Selection::Waypoints { file_id }
            | Selection::Waypoint { file_id, .. } => vec![*file_id],
        };
        let file_ids: Vec<FileId> = file_ids
            .into_iter()
            .filter(|id| state.files.contains_key(id))
            .collect();
        if file_ids.is_empty() {
            return Err(CommandError::NothingToDo);
        }

        for id in file_ids {
            let mut waypoint = Waypoint::default();
            set_waypoint_fields(
                &mut waypoint,
                (self.lng, self.lat, self.ele),
                self.name,
                self.desc,
                self.icon,
                self.link,
            );
            let file: &mut File = Rc::make_mut(state.files.get_mut(&id).unwrap());
            insert_waypoints_at(file, usize::MAX, vec![waypoint]);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{New, TrackId, TrackSegmentId, engine::command::fixture::Fixture, waypoint_ids};

    use super::*;

    fn new_waypoint(name: &str) -> NewWaypoint<'_> {
        NewWaypoint {
            lng: 4.5,
            lat: 50.25,
            ele: 123.0,
            name,
            desc: "a description",
            icon: "Summit",
            link: "https://example.com",
        }
    }

    fn waypoints(fx: &Fixture, id: FileId) -> Vec<Waypoint> {
        fx.files[&id]
            .wpt
            .iter()
            .flat_map(|chunk| chunk.wpt.iter().cloned())
            .collect()
    }

    #[test]
    fn test_new_waypoint_in_the_selected_file() {
        let mut fx = Fixture::default();
        New {
            name: "a",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        New {
            name: "b",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        let (a, b) = (fx.order.0[0], fx.order.0[1]);
        let rev = fx.files[&b].wpt_rev_id;

        // b is selected
        new_waypoint("peak").apply(&mut fx.state()).unwrap();
        assert!(waypoints(&fx, a).is_empty());
        let created = waypoints(&fx, b);
        assert_eq!(created.len(), 1);
        let wpt = &created[0];
        assert_eq!(
            (wpt.coordinates.lng, wpt.coordinates.lat, wpt.ele),
            (4.5, 50.25, 123.0)
        );
        assert_eq!(wpt.name.as_deref(), Some("peak"));
        assert_eq!(wpt.desc.as_deref(), Some("a description"));
        assert_eq!(wpt.cmt.as_deref(), Some("a description"));
        assert_eq!(wpt.sym.as_deref(), Some("Summit"));
        assert_eq!(
            wpt.link.as_ref().map(|l| l.href.as_str()),
            Some("https://example.com")
        );
        assert_ne!(fx.files[&b].wpt_rev_id, rev);

        // added after the others
        let mut second = new_waypoint("second");
        second.lng = 5.0;
        second.apply(&mut fx.state()).unwrap();
        let names: Vec<_> = waypoints(&fx, b)
            .iter()
            .map(|w| w.name.clone().unwrap())
            .collect();
        assert_eq!(names, ["peak", "second"]);
        // and not selected
        assert_eq!(fx.selected_files(), [b].into());
    }

    #[test]
    fn test_empty_fields_are_not_set() {
        let mut fx = Fixture::default();
        New {
            name: "a",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        let a = fx.order.0[0];
        NewWaypoint {
            lng: 1.0,
            lat: 2.0,
            ele: 0.0,
            name: "",
            desc: "",
            icon: "",
            link: "",
        }
        .apply(&mut fx.state())
        .unwrap();
        let wpt = &waypoints(&fx, a)[0];
        assert!(wpt.name.is_none() && wpt.desc.is_none() && wpt.cmt.is_none());
        assert!(wpt.sym.is_none() && wpt.link.is_none());
    }

    #[test]
    fn test_each_selected_file_gets_its_own_waypoint() {
        let mut fx = Fixture::default();
        for name in ["a", "b", "c"] {
            New {
                name,
                trackpoint: None,
            }
            .apply(&mut fx.state())
            .unwrap();
        }
        let ids = fx.order.0.clone();
        fx.selection = Selection::File {
            file_ids: HashSet::from([ids[0], ids[2]]),
        };
        new_waypoint("w").apply(&mut fx.state()).unwrap();
        assert_eq!(waypoints(&fx, ids[0]).len(), 1);
        assert!(waypoints(&fx, ids[1]).is_empty());
        assert_eq!(waypoints(&fx, ids[2]).len(), 1);
        // not the same waypoint
        assert_ne!(waypoints(&fx, ids[0])[0].id, waypoints(&fx, ids[2])[0].id);
    }

    #[test]
    fn test_the_file_of_the_selected_elements_is_used() {
        for selection in [
            |id| Selection::Track {
                file_id: id,
                trk_ids: [TrackId::default()].into(),
            },
            |id| Selection::TrackSegment {
                file_id: id,
                trk_id: TrackId::default(),
                trkseg_ids: [TrackSegmentId::default()].into(),
            },
            |id| Selection::Waypoints { file_id: id },
            |id| Selection::Waypoint {
                file_id: id,
                wpt_ids: HashSet::new(),
            },
        ] {
            let mut fx = Fixture::default();
            New {
                name: "a",
                trackpoint: None,
            }
            .apply(&mut fx.state())
            .unwrap();
            let a = fx.order.0[0];
            fx.selection = selection(a);
            new_waypoint("w").apply(&mut fx.state()).unwrap();
            assert_eq!(waypoint_ids(&fx.files[&a]).count(), 1);
        }
    }

    #[test]
    fn test_nothing_selected_or_unknown_file() {
        let mut fx = Fixture::default();
        New {
            name: "a",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        fx.selection = Selection::Empty;
        assert_eq!(
            new_waypoint("w").apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.selection = Selection::Waypoints {
            file_id: FileId::default(),
        };
        assert_eq!(
            new_waypoint("w").apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert_eq!(fx.files.len(), 1);
    }
}
