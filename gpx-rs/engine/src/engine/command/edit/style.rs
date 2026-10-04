use crate::{Apply, CommandError, Edit, Editor, State, Track, update_selected};

#[derive(Debug)]
pub struct Style<'a> {
    pub color: Option<&'a str>,
    pub opacity: Option<f64>,
    pub width: Option<f64>,
}

impl Apply for Style<'_> {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for Style<'_> {
    fn track(&mut self, track: &mut Track) -> Edit {
        if let Some(color) = self.color {
            track.info.color = Some(color.to_owned());
        }
        if self.opacity.is_some() {
            track.info.opacity = self.opacity;
        }
        if self.width.is_some() {
            track.info.width = self.width;
        }
        Edit::Changed
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{Selection, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_style_applies_to_all_tracks_of_selected_file_and_keeps_unset_fields() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_style.gpx").unwrap();
        crate::Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = *fx.files.keys().next().unwrap();
        let before = fx.files[&id].clone();
        assert!(!before.trk.is_empty());
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };

        Style {
            color: Some("ff0000"),
            opacity: None,
            width: Some(7.0),
        }
        .apply(&mut fx.state())
        .unwrap();

        for (b, a) in before.trk.iter().zip(fx.files[&id].trk.iter()) {
            assert_eq!(a.info.color.as_deref(), Some("ff0000"));
            assert_eq!(a.info.width, Some(7.0));
            assert_eq!(a.info.opacity, b.info.opacity);
        }
    }
}
