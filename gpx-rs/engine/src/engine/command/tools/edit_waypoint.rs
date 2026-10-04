use crate::{
    Apply, CommandError, Edit, Editor, State, Waypoint, set_waypoint_fields, update_selected,
};

/// Changes the selected waypoints (what the form of the waypoint tool does): their name,
/// description, icon, link, position and elevation. The strings that are empty remove the field.
#[derive(Debug)]
pub struct EditWaypoint<'a> {
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
    pub name: &'a str,
    pub desc: &'a str,
    pub icon: &'a str,
    pub link: &'a str,
}

impl Apply for EditWaypoint<'_> {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for EditWaypoint<'_> {
    fn waypoint(&mut self, waypoint: &mut Waypoint) -> Edit {
        set_waypoint_fields(
            waypoint,
            (self.lng, self.lat, self.ele),
            self.name,
            self.desc,
            self.icon,
            self.link,
        );
        Edit::Changed
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::HashSet, rc::Rc};

    use crate::{
        File, Link, Selection, WaypointChunk, engine::command::fixture::Fixture, waypoint_ids,
    };

    use super::*;

    #[test]
    fn test_edit_the_selected_waypoint() {
        let mut fx = Fixture::default();
        let mut file = File::default();
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: vec![
                Waypoint {
                    name: Some("old".into()),
                    desc: Some("old description".into()),
                    cmt: Some("old comment".into()),
                    sym: Some("Flag".into()),
                    link: Some(Link {
                        href: "https://old".into(),
                        text: None,
                    }),
                    ..Default::default()
                },
                Waypoint {
                    name: Some("other".into()),
                    ..Default::default()
                },
            ],
            ..Default::default()
        }));
        let id = file.id;
        let ids: Vec<_> = waypoint_ids(&file).collect();
        fx.files.insert(id, Rc::new(file));
        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([ids[0]]),
        };

        EditWaypoint {
            lng: 4.5,
            lat: 50.5,
            ele: 12.0,
            name: "new",
            desc: "new description",
            icon: "Summit",
            link: "",
        }
        .apply(&mut fx.state())
        .unwrap();

        let wpts: Vec<_> = fx.files[&id]
            .wpt
            .iter()
            .flat_map(|c| c.wpt.iter())
            .collect();
        let edited = wpts[0];
        assert_eq!(edited.id, ids[0]);
        assert_eq!(edited.name.as_deref(), Some("new"));
        assert_eq!(edited.desc.as_deref(), Some("new description"));
        assert_eq!(edited.cmt.as_deref(), Some("new description"));
        assert_eq!(edited.sym.as_deref(), Some("Summit"));
        // an empty link removes it
        assert!(edited.link.is_none());
        assert_eq!(
            (edited.coordinates.lng, edited.coordinates.lat, edited.ele),
            (4.5, 50.5, 12.0)
        );
        // the other waypoint is as it was
        assert_eq!(wpts[1].name.as_deref(), Some("other"));
    }
}
