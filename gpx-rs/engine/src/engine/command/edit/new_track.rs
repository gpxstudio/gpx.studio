use crate::{Apply, CommandError, Edit, Editor, File, State, Track, update_selected};

#[derive(Debug)]
pub struct NewTrack;

impl Apply for NewTrack {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for NewTrack {
    fn file(&mut self, file: &mut File) -> Edit {
        let mut track = Track::default();
        track.info.color = common(file, |t| &t.info.color);
        track.info.opacity = common(file, |t| &t.info.opacity);
        track.info.width = common(file, |t| &t.info.width);
        file.trk.push(track);
        Edit::Changed
    }
}

/// Returns the value of a style attribute if all existing tracks agree on it.
fn common<T: Clone + PartialEq>(file: &File, get: impl Fn(&Track) -> &Option<T>) -> Option<T> {
    let mut tracks = file.trk.iter();
    let first = get(tracks.next()?);
    tracks.all(|t| get(t) == first).then(|| first.clone())?
}

#[cfg(test)]
mod tests {
    use crate::{New, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_new_track() {
        let mut fx = Fixture::default();
        New { name: "file" }.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.trk.len(), 2);
        assert_ne!(file.trk[0].id, file.trk[1].id);
    }

    #[test]
    fn test_new_track_inherits_agreeing_style_only() {
        let mut fx = Fixture::default();
        New { name: "file" }.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        let file = std::rc::Rc::make_mut(fx.files.values_mut().next().unwrap());
        for (i, trk) in file.trk.iter_mut().enumerate() {
            trk.info.color = Some("ff0000".into());
            trk.info.opacity = Some(0.5 + i as f64 * 0.1);
        }
        NewTrack.apply(&mut fx.state()).unwrap();
        let info = &fx.files.values().next().unwrap().trk[2].info;
        assert_eq!(info.color.as_deref(), Some("ff0000"));
        assert_eq!(info.opacity, None);
        assert_eq!(info.width, None);
    }
}
