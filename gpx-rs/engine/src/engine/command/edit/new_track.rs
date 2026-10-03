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
        file.trk.push(Track::default());
        Edit::Changed
    }
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
}
