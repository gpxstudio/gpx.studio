use crate::{Apply, CommandError, Edit, Editor, File, Route, State, update_selected};

use super::new_track::common_style;

/// Adds an empty route to the selected files, with the style that their routes and tracks agree
/// on (see [`crate::NewTrack`]).
#[derive(Debug)]
pub struct NewRoute;

impl Apply for NewRoute {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for NewRoute {
    fn file(&mut self, file: &mut File) -> Edit {
        file.rte.push(Route {
            info: common_style(file),
            ..Default::default()
        });
        Edit::Changed
    }
}

#[cfg(test)]
mod tests {
    use crate::{New, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_new_route_has_the_style_of_the_tracks_and_an_empty_segment() {
        let mut fx = Fixture::default();
        New {
            name: "file",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        crate::NewTrack.apply(&mut fx.state()).unwrap();
        let file = std::rc::Rc::make_mut(fx.files.values_mut().next().unwrap());
        file.trk[0].info.color = Some("ff0000".into());
        NewRoute.apply(&mut fx.state()).unwrap();
        NewRoute.apply(&mut fx.state()).unwrap();

        let file = fx.files.values().next().unwrap();
        assert_eq!(file.rte.len(), 2);
        assert_ne!(file.rte[0].id, file.rte[1].id);
        assert!(file.rte[0].seg.is_empty());
        assert_eq!(file.rte[1].info.color.as_deref(), Some("ff0000"));
    }
}
