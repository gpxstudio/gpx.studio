use crate::{Apply, CommandError, State, round_trip, update_segments};

/// Makes each selected segment come back to where it started: the segments of the selected files
/// and tracks, and the selected segments, get a reversed copy of themselves after their last
/// trackpoint (see [`round_trip`]).
///
/// There is nothing to do for segments with fewer than two trackpoints, which have no way back.
#[derive(Debug)]
pub struct RoundTrip;

impl Apply for RoundTrip {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let locations: Vec<_> = state
            .selection
            .segment_locations(state.files, &state.order.0)
            .into_iter()
            .filter(|l| state.files[&l.file_id].trk[l.trk].trkseg[l.seg].len() >= 2)
            .collect();
        if locations.is_empty() {
            return Err(CommandError::NothingToDo);
        }
        update_segments(state, &locations, |_, segment| round_trip(segment));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::rc::Rc;

    use crate::{
        FileId, Load, Selection, TrackSegment, end_time, engine::command::fixture::Fixture,
    };

    use super::*;

    fn loaded(path: &str) -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read(path).unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = fx.order.0[0];
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        (fx, id)
    }

    fn segments(fx: &Fixture, id: FileId) -> Vec<TrackSegment> {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|track| track.trkseg.iter().cloned())
            .collect()
    }

    fn lngs(segment: &TrackSegment) -> Vec<f64> {
        segment.iter().map(|p| p.coordinates.lng).collect()
    }

    #[test]
    fn test_every_segment_of_a_file_comes_back() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let before = segments(&fx, id);
        RoundTrip.apply(&mut fx.state()).unwrap();
        let after = segments(&fx, id);
        assert_eq!(after.len(), before.len());
        for (a, b) in after.iter().zip(&before) {
            if b.len() < 2 {
                assert_eq!(a.len(), b.len());
                assert_eq!(a.rev_id, b.rev_id);
                continue;
            }
            assert_eq!(a.id, b.id);
            // the last trackpoint is not repeated
            assert_eq!(a.len(), 2 * b.len() - 1);
            let mut expected = lngs(b);
            expected.extend(lngs(b).into_iter().rev().skip(1));
            assert_eq!(lngs(a), expected);
        }
    }

    #[test]
    fn test_only_the_selected_segment_comes_back() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let trk = &file.trk[0];
        assert!(trk.trkseg.len() >= 2);
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trk.trkseg[1].id]),
        };
        RoundTrip.apply(&mut fx.state()).unwrap();
        let after = &fx.files[&id].trk[0];
        assert_eq!(after.trkseg[1].len(), 2 * trk.trkseg[1].len() - 1);
        assert_eq!(after.trkseg[0].rev_id, trk.trkseg[0].rev_id);
    }

    #[test]
    fn test_times_go_on_from_the_end() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = segments(&fx, id).remove(0);
        RoundTrip.apply(&mut fx.state()).unwrap();
        let after = segments(&fx, id).remove(0);
        let n = before.len();
        let end = end_time(&before).unwrap();
        assert_eq!(after.len(), 2 * n - 1);
        // the original part is untouched
        for i in 0..n {
            assert_eq!(after[i].time, before[i].time);
        }
        // the way back goes on from the end, and lasts as long as the way there
        for i in 1..n {
            assert_eq!(
                after[n - 1 + i].time.unwrap(),
                2 * end - before[n - 1 - i].time.unwrap()
            );
        }
        assert_eq!(end_time(&after), Some(2 * end - before[0].time.unwrap()));
    }

    #[test]
    fn test_nothing_to_do_without_a_way_back() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = fx.files[&id].clone();
        fx.selection = Selection::Empty;
        assert_eq!(
            RoundTrip.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.selection = Selection::Waypoints { file_id: id };
        assert_eq!(
            RoundTrip.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
