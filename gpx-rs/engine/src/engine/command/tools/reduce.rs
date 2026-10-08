use std::rc::Rc;

use crate::{Apply, CommandError, File, State, Trackpoint, reduce_indices};

/// Removes the trackpoints of the selected segments that are less than `tolerance` meters away
/// from the line of their neighbours (Ramer-Douglas-Peucker, see [`reduce_indices`]). The ends of the segments are
/// kept.
#[derive(Debug)]
pub struct Reduce {
    pub tolerance: f64,
}

impl Apply for Reduce {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        if !(self.tolerance.is_finite() && self.tolerance > 0.0) {
            return Err(CommandError::InvalidData(format!(
                "tolerance {} should be positive",
                self.tolerance
            )));
        }

        let locations = state
            .selection
            .segment_locations(state.files, &state.order.0);
        let mut reduced = vec![];
        for location in &locations {
            let segment = &state.files[&location.file_id].trk[location.trk].trkseg[location.seg];
            let kept = reduce_indices(segment, self.tolerance);
            if kept.len() == segment.len() {
                continue;
            }
            let points: Vec<Trackpoint> = kept.iter().map(|&i| segment[i].clone()).collect();
            reduced.push((*location, points));
        }
        if reduced.is_empty() {
            return Err(CommandError::NothingToDo);
        }

        // the segments of a file are consecutive
        for group in reduced.chunk_by(|a, b| a.0.file_id == b.0.file_id) {
            let file_id = group[0].0.file_id;
            let mut file: File = (*state.files[&file_id]).clone();
            for (location, points) in group {
                let segment = &mut file.trk[location.trk].trkseg[location.seg];
                let len = segment.len();
                segment.splice(0, len, points.clone());
                segment.rev_id = Default::default();
            }
            state.files.insert(file_id, Rc::new(file));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, Selection, engine::command::fixture::Fixture, reduction_distances};

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

    fn count(fx: &Fixture, id: FileId) -> usize {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|trk| &trk.trkseg)
            .map(|seg| seg.len())
            .sum()
    }

    #[test]
    fn test_a_larger_tolerance_keeps_fewer_points_and_the_ends() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = count(&fx, id);
        let first = fx.files[&id].trk[0].trkseg[0][0].coordinates;

        Reduce { tolerance: 5.0 }.apply(&mut fx.state()).unwrap();
        let medium = count(&fx, id);
        assert!(medium < before);
        assert_eq!(fx.files[&id].trk[0].trkseg[0][0].coordinates.lng, first.lng);

        Reduce { tolerance: 500.0 }.apply(&mut fx.state()).unwrap();
        assert!(count(&fx, id) < medium);
    }

    #[test]
    fn test_the_distances_tell_which_points_are_kept() {
        for path in ["data/with_time.gpx", "data/with_tracks_and_segments.gpx"] {
            let (fx, id) = loaded(path);
            for seg in fx.files[&id].trk.iter().flat_map(|trk| &trk.trkseg) {
                let distances = reduction_distances(seg);
                for tolerance in [0.1, 0.5, 1.0, 3.0, 10.0, 30.0, 100.0, 1000.0] {
                    let from_distances: Vec<usize> = (0..seg.len())
                        .filter(|&i| distances[i] > tolerance)
                        .collect();
                    assert_eq!(
                        from_distances,
                        reduce_indices(seg, tolerance),
                        "{path} {tolerance}"
                    );
                }
            }
        }
    }

    #[test]
    fn test_only_the_selected_segments_are_reduced() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let others: usize = fx.files[&id]
            .trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .skip(1)
            .map(|s| s.len())
            .sum();
        let expected = reduce_indices(&fx.files[&id].trk[0].trkseg[0], 5.0).len();
        fx.selection = {
            let track = &fx.files[&id].trk[0];
            Selection::TrackSegment {
                file_id: id,
                trk_id: track.id,
                trkseg_ids: HashSet::from([track.trkseg[0].id]),
            }
        };
        Reduce { tolerance: 5.0 }.apply(&mut fx.state()).unwrap();
        assert_eq!(count(&fx, id), expected + others);
    }

    #[test]
    fn test_invalid_tolerance_and_nothing_to_remove() {
        let (mut fx, _) = loaded("data/simple.gpx");
        assert!(matches!(
            Reduce { tolerance: 0.0 }.apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        assert!(matches!(
            Reduce { tolerance: 1e-9 }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        ));
    }
}
