use crate::{Apply, CommandError, Edit, Editor, File, State, Track, update_selected};

#[derive(Debug)]
pub struct Metadata<'a> {
    pub name: &'a str,
    pub desc: &'a str,
}

impl Apply for Metadata<'_> {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for Metadata<'_> {
    fn file(&mut self, file: &mut File) -> Edit {
        file.info.name = self.name.to_owned();
        file.info.desc = Some(self.desc.to_owned());
        // a single track is named like the file
        if let [track] = file.trk.as_mut_slice() {
            track.info.name = Some(self.name.to_owned());
        }
        Edit::Changed
    }

    fn track(&mut self, track: &mut Track) -> Edit {
        track.info.name = Some(self.name.to_owned());
        track.info.desc = Some(self.desc.to_owned());
        Edit::Changed
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{New, NewTrack, Selection, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_metadata_applies_to_selected_file() {
        let mut fx = Fixture::default();
        New {
            name: "first",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        New {
            name: "second",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap(); // now selected
        let selected = *fx.selected_files().iter().next().unwrap();

        Metadata {
            name: "renamed",
            desc: "description",
        }
        .apply(&mut fx.state())
        .unwrap();

        for (id, file) in fx.files.iter() {
            if *id == selected {
                assert_eq!(file.info.name, "renamed");
                assert_eq!(file.info.desc.as_deref(), Some("description"));
            } else {
                assert_eq!(file.info.name, "first");
                assert_eq!(file.info.desc, None);
            }
        }
    }

    #[test]
    fn test_metadata_applies_to_selected_track() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks.gpx").unwrap();
        crate::Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let file = fx.files.values().next().unwrap().clone();
        fx.selection = Selection::Track {
            file_id: file.id,
            trk_ids: HashSet::from([file.trk[0].id]),
        };

        Metadata {
            name: "renamed",
            desc: "",
        }
        .apply(&mut fx.state())
        .unwrap();

        let after = &fx.files[&file.id];
        assert_eq!(after.info.name, file.info.name);
        assert_eq!(after.trk[0].info.name.as_deref(), Some("renamed"));
        assert_eq!(after.trk[1].info, file.trk[1].info);
    }

    /// A new file with `nb_tracks` tracks (without name), selected.
    fn file_with_tracks(fx: &mut Fixture, nb_tracks: usize) {
        New {
            name: "file",
            trackpoint: None,
        }
        .apply(&mut fx.state())
        .unwrap();
        for _ in 0..nb_tracks {
            NewTrack.apply(&mut fx.state()).unwrap();
        }
    }

    fn rename(fx: &mut Fixture) {
        Metadata {
            name: "renamed",
            desc: "",
        }
        .apply(&mut fx.state())
        .unwrap();
    }

    #[test]
    fn test_single_track_is_renamed_like_the_file() {
        let mut fx = Fixture::default();
        file_with_tracks(&mut fx, 1);
        rename(&mut fx);
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.info.name, "renamed");
        assert_eq!(file.trk[0].info.name.as_deref(), Some("renamed"));
    }

    #[test]
    fn test_single_track_with_a_name_is_renamed_too() {
        let mut fx = Fixture::default();
        file_with_tracks(&mut fx, 1);
        let id = *fx.files.keys().next().unwrap();
        std::rc::Rc::make_mut(fx.files.get_mut(&id).unwrap()).trk[0]
            .info
            .name = Some("track".to_owned());
        rename(&mut fx);
        let file = &fx.files[&id];
        assert_eq!(file.info.name, "renamed");
        assert_eq!(file.trk[0].info.name.as_deref(), Some("renamed"));
    }

    #[test]
    fn test_several_tracks_are_not_renamed() {
        let mut fx = Fixture::default();
        file_with_tracks(&mut fx, 2);
        rename(&mut fx);
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.info.name, "renamed");
        assert!(file.trk.iter().all(|trk| trk.info.name.is_none()));
    }
}
