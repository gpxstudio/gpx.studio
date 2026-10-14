use crate::{
    Apply, CommandError, State, TrackSegment, artificial_segment_times, changed_segment_times,
    update_segments,
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
        let segments: Vec<&TrackSegment> = locations
            .iter()
            .map(|l| &state.files[&l.file_id].trk[l.trk].trkseg[l.seg])
            .collect();
        if segments.iter().all(|segment| segment.is_empty()) {
            return Err(CommandError::NothingToDo);
        }

        let times = match self.kind {
            TimeKind::Change { speed, ratio } => {
                changed_segment_times(&segments, self.start_time, speed, ratio)
            }
            TimeKind::Artificial { total_time } => {
                artificial_segment_times(&segments, self.start_time, total_time)
            }
        };

        update_segments(state, &locations, |i, segment| {
            let times = &times[i];
            segment.update_all(|j, pt| pt.time = times.get(j).copied().flatten());
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

    fn all_times(fx: &Fixture, id: FileId) -> Vec<Option<i64>> {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|trk| {
                trk.trkseg
                    .iter()
                    .flat_map(|seg| seg.iter().map(|pt| pt.time))
            })
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
