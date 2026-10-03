use crate::{Apply, CommandError, Edit, Editor, State, Track, TrackSegment, update_selected};

#[derive(Debug)]
pub struct NewTrackSegment;

impl Apply for NewTrackSegment {
    fn apply(mut self, state: &mut State) -> Result<(), CommandError> {
        update_selected(state, &mut self);
        Ok(())
    }
}

impl Editor for NewTrackSegment {
    fn track(&mut self, track: &mut Track) -> Edit {
        track.trkseg.push(TrackSegment::default());
        Edit::Changed
    }
}

#[cfg(test)]
mod tests {
    use crate::{New, NewTrack, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_new_track_segment_on_each_track_of_selected_file() {
        let mut fx = Fixture::default();
        New { name: "file" }.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        NewTrack.apply(&mut fx.state()).unwrap();
        NewTrackSegment.apply(&mut fx.state()).unwrap();
        let file = fx.files.values().next().unwrap();
        assert!(file.trk.iter().all(|t| t.trkseg.len() == 1));
    }
}
