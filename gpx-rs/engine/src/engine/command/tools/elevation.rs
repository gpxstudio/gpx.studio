use crate::{Apply, CommandError, State, update_segments};

/// Sets the elevation of the trackpoints of the selected segments (the ones of the statistics of
/// the selection, in the same order): `ele` has one elevation per trackpoint.
#[derive(Debug)]
pub struct Elevation<'a> {
    pub ele: &'a [f64],
}

impl Apply for Elevation<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let locations = state
            .selection
            .segment_locations(state.files, &state.order.0);
        let count: usize = locations
            .iter()
            .map(|location| {
                state.files[&location.file_id].trk[location.trk].trkseg[location.seg].len()
            })
            .sum();
        if count == 0 {
            return Err(CommandError::NothingToDo);
        }
        if count != self.ele.len() {
            return Err(CommandError::InvalidData(format!(
                "{} elevations for {count} trackpoints",
                self.ele.len()
            )));
        }

        let mut ele = self.ele.iter().copied();
        update_segments(state, &locations, |_, segment| {
            segment.update_all(|_, pt| pt.ele = ele.next().unwrap_or(pt.ele));
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, Selection, engine::command::fixture::Fixture};

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

    fn trackpoint_elevations(fx: &Fixture, id: FileId) -> Vec<f64> {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|trk| {
                trk.trkseg
                    .iter()
                    .flat_map(|seg| seg.iter().map(|pt| pt.ele))
            })
            .collect()
    }

    #[test]
    fn test_a_file_gets_elevation_on_all_its_trackpoints() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let count = trackpoint_elevations(&fx, id).len();
        let ele: Vec<f64> = (0..count).map(|i| 100.0 + i as f64).collect();

        Elevation { ele: &ele }.apply(&mut fx.state()).unwrap();

        assert_eq!(trackpoint_elevations(&fx, id), ele);
    }

    #[test]
    fn test_segments_only_touch_their_trackpoints() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let before = trackpoint_elevations(&fx, id);
        let track = &fx.files[&id].trk[0];
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: HashSet::from([track.trkseg[0].id]),
        };
        let rev_ids: Vec<_> = track.trkseg.iter().map(|seg| seg.rev_id).collect();
        let len = track.trkseg[0].len();

        Elevation {
            ele: &vec![5.0; len],
        }
        .apply(&mut fx.state())
        .unwrap();

        let after = trackpoint_elevations(&fx, id);
        assert_eq!(after[..len], vec![5.0; len]);
        assert_eq!(after[len..], before[len..]);
        let segments = &fx.files[&id].trk[0].trkseg;
        assert_ne!(segments[0].rev_id, rev_ids[0]);
        assert_eq!(segments[1].rev_id, rev_ids[1]);
    }

    #[test]
    fn test_wrong_number_of_elevations() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = trackpoint_elevations(&fx, id);
        assert!(matches!(
            Elevation { ele: &[1.0] }.apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        assert_eq!(trackpoint_elevations(&fx, id), before);
    }

    #[test]
    fn test_nothing_selected() {
        let (mut fx, _) = loaded("data/simple.gpx");
        fx.selection = Selection::Empty;
        assert!(matches!(
            Elevation { ele: &[] }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        ));
    }
}
