use std::rc::Rc;

use crate::{
    Apply, CommandError, File, SegmentLocation, State, Statistics, TrackSegment, Trackpoint, artificial_weights,
    shifted_and_compressed, with_artificial_timestamps, with_timestamps,
};

/// How the timestamps of the selection are set.
#[derive(Debug, Clone, Copy)]
pub enum TimeKind {
    /// Starts at `Time::start_time`. The trackpoints that have timestamps keep their durations
    /// multiplied by `ratio`, and the ones that have none follow the previous one at `speed`
    /// (km/h).
    Change { speed: f64, ratio: f64 },
    /// Makes timestamps up for the whole selection, which lasts `total_time` seconds: the longer
    /// and the steeper an interval, the more time it takes.
    Artificial { total_time: f64 },
}

/// Sets the timestamps of the selected segments, one after the other: each one goes on from the
/// end of the previous one, the first one starts at `start_time` (in milliseconds).
#[derive(Debug)]
pub struct Time {
    pub start_time: i64,
    pub kind: TimeKind,
}

impl Apply for Time {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        match self.kind {
            TimeKind::Change { speed, ratio } => {
                if !(speed.is_finite() && speed > 0.0 && ratio.is_finite() && ratio > 0.0) {
                    return Err(CommandError::InvalidData(format!(
                        "speed {speed} and ratio {ratio} should be positive"
                    )));
                }
            }
            TimeKind::Artificial { total_time } => {
                if !(total_time.is_finite() && total_time >= 0.0) {
                    return Err(CommandError::InvalidData(format!(
                        "total time {total_time} should not be negative"
                    )));
                }
            }
        }

        let locations = state
            .selection
            .segment_locations(state.files, &state.order.0);
        let segment_at = |location: &SegmentLocation| -> &TrackSegment {
            &state.files[&location.file_id].trk[location.trk].trkseg[location.seg]
        };
        if locations.iter().all(|location| segment_at(location).is_empty()) {
            return Err(CommandError::NothingToDo);
        }

        // the new timestamps of each segment
        let mut times: Vec<Vec<Option<i64>>> = Vec::with_capacity(locations.len());
        match self.kind {
            TimeKind::Change { speed, ratio } => {
                let mut last: Option<Trackpoint> = None;
                for location in &locations {
                    let points: Vec<Trackpoint> = segment_at(location).iter().cloned().collect();
                    let Some(first) = points.first() else {
                        times.push(vec![]);
                        continue;
                    };
                    let start = last.clone().unwrap_or_else(|| {
                        let mut start = first.clone();
                        start.time = Some(self.start_time);
                        start
                    });
                    let points = if first.time.is_none() {
                        with_timestamps(points, Some(speed), Some(&start), Some(self.start_time))
                    } else {
                        shifted_and_compressed(points, Some(speed), ratio, &start)
                    };
                    last = points.last().cloned();
                    times.push(points.iter().map(|point| point.time).collect());
                }
            }
            TimeKind::Artificial { total_time } => {
                let mut weights: Vec<Vec<f64>> = locations
                    .iter()
                    .map(|location| {
                        let segment = segment_at(location);
                        let points: Vec<Trackpoint> = segment.iter().cloned().collect();
                        let stats = Statistics::compute(segment);
                        let slopes: Vec<f64> = stats.local.iter().map(|l| l.slope).collect();
                        artificial_weights(&points, &slopes)
                    })
                    .collect();
                let mut total: f64 = weights.iter().flatten().sum();
                if !(total > 0.0) {
                    // no distance to share the time by: every interval takes as long
                    for weights in &mut weights {
                        weights.iter_mut().for_each(|w| *w = 1.0);
                    }
                    total = weights.iter().map(Vec::len).sum::<usize>() as f64;
                }
                let ms_per_weight = if total > 0.0 {
                    total_time * 1000.0 / total
                } else {
                    0.0
                };

                let mut start = self.start_time;
                for (location, weights) in locations.iter().zip(&weights) {
                    let points: Vec<Trackpoint> = segment_at(location).iter().cloned().collect();
                    if points.is_empty() {
                        times.push(vec![]);
                        continue;
                    }
                    let points = with_artificial_timestamps(points, weights, ms_per_weight, start);
                    // the next segment goes on from the end of this one
                    start = points.last().and_then(|point| point.time).unwrap_or(start);
                    times.push(points.iter().map(|point| point.time).collect());
                }
            }
        }

        // the segments of a file are consecutive
        let mut times = times.into_iter();
        for group in locations.chunk_by(|a, b| a.file_id == b.file_id) {
            let file_id = group[0].file_id;
            let mut file: File = (*state.files[&file_id]).clone();
            for location in group {
                let times = times.next().unwrap_or_default();
                let segment = &mut file.trk[location.trk].trkseg[location.seg];
                segment.update_all(|i, pt| pt.time = times.get(i).copied().flatten());
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

    fn all_times(fx: &Fixture, id: FileId) -> Vec<Option<i64>> {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|trk| trk.trkseg.iter().flat_map(|seg| seg.iter().map(|pt| pt.time)))
            .collect()
    }

    #[test]
    fn test_artificial_timestamps_last_the_total_time() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");

        Time {
            start_time: 1_000_000,
            kind: TimeKind::Artificial { total_time: 3600.0 },
        }
        .apply(&mut fx.state())
        .unwrap();

        let times: Vec<i64> = all_times(&fx, id).into_iter().map(Option::unwrap).collect();
        assert_eq!(times[0], 1_000_000);
        assert!(times.windows(2).all(|w| w[0] <= w[1]));
        assert!((times.last().unwrap() - 1_000_000 - 3_600_000).abs() <= times.len() as i64);
    }

    #[test]
    fn test_change_starts_at_the_start_time_and_follows_the_speed() {
        let (mut fx, id) = loaded("data/simple.gpx");
        Time {
            start_time: 5_000,
            kind: TimeKind::Change {
                speed: 10.0,
                ratio: 1.0,
            },
        }
        .apply(&mut fx.state())
        .unwrap();

        let times: Vec<i64> = all_times(&fx, id).into_iter().map(Option::unwrap).collect();
        assert_eq!(times[0], 5_000);
        assert!(times.windows(2).all(|w| w[0] <= w[1]));
        assert!(times.last() > times.first());
    }

    #[test]
    fn test_change_shifts_existing_timestamps_and_scales_them() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before: Vec<i64> = all_times(&fx, id).into_iter().map(Option::unwrap).collect();

        Time {
            start_time: 0,
            kind: TimeKind::Change {
                speed: 10.0,
                ratio: 2.0,
            },
        }
        .apply(&mut fx.state())
        .unwrap();

        let after: Vec<i64> = all_times(&fx, id).into_iter().map(Option::unwrap).collect();
        assert_eq!(after[0], 0);
        let (d_before, d_after) = (before[1] - before[0], after[1] - after[0]);
        assert!((d_after - 2 * d_before).abs() <= 1);
    }

    #[test]
    fn test_invalid_input_and_empty_selection() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = all_times(&fx, id);
        assert!(matches!(
            Time {
                start_time: 0,
                kind: TimeKind::Change {
                    speed: 0.0,
                    ratio: 1.0
                }
            }
            .apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        assert_eq!(all_times(&fx, id), before);

        fx.selection = Selection::Empty;
        assert!(matches!(
            Time {
                start_time: 0,
                kind: TimeKind::Artificial { total_time: 10.0 }
            }
            .apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        ));
    }
}
