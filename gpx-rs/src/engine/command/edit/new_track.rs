use crate::{Apply, CommandError, Edit, Editor, File, State, Track, TrackInfo, update_selected};

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
        file.trk.push(Track {
            info: common_style(file),
            ..Default::default()
        });
        Edit::Changed
    }
}

/// The style that all the routes and tracks of the file agree on: each attribute is set if they
/// all have the same value for it.
pub(super) fn common_style(file: &File) -> TrackInfo {
    let infos: Vec<&TrackInfo> = file
        .rte
        .iter()
        .map(|rte| &rte.info)
        .chain(file.trk.iter().map(|trk| &trk.info))
        .collect();
    TrackInfo {
        color: common(&infos, |info| &info.color),
        opacity: common(&infos, |info| &info.opacity),
        width: common(&infos, |info| &info.width),
        ..Default::default()
    }
}

/// Returns the value of a style attribute if all the infos agree on it.
fn common<T: Clone + PartialEq>(
    infos: &[&TrackInfo],
    get: impl Fn(&TrackInfo) -> &Option<T>,
) -> Option<T> {
    let mut infos = infos.iter();
    let first = get(infos.next()?);
    infos
        .all(|info| get(info) == first)
        .then(|| first.clone())?
}

#[cfg(test)]
mod tests {
    use crate::{New, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_new_track() {
        let mut fx = Fixture::default();
        New {
            name: "file",
            trackpoint: None,
            route: false,
        }
        .apply(&mut fx.state())
        .unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.trk.len(), 2);
        assert_ne!(file.trk[0].id, file.trk[1].id);
    }

    #[test]
    fn test_new_track_inherits_agreeing_style_only() {
        let mut fx = Fixture::default();
        New {
            name: "file",
            trackpoint: None,
            route: false,
        }
        .apply(&mut fx.state())
        .unwrap();
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
