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

    use crate::{New, Selection, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_metadata_applies_to_selected_file() {
        let mut fx = Fixture::default();
        New { name: "first" }.apply(&mut fx.state()).unwrap();
        New { name: "second" }.apply(&mut fx.state()).unwrap(); // now selected
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
        crate::Load { data: &data }.apply(&mut fx.state()).unwrap();
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
}
