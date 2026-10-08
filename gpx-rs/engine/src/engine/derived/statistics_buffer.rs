use crate::{GlobalStatistics, Statistics, TrackSegment, sum_options};

/// Value of the timestamps of the trackpoints that have none.
pub const NO_TIME: i64 = i64::MIN;

/// Flattened statistics of the selected segments, one entry per trackpoint, in selection order.
///
/// The distance, time, moving and elevation values are cumulative over the whole selection (the
/// second segment continues where the first one ended), so the statistics of any range of
/// trackpoints are the difference between its two ends: see [`StatisticsBuffer::slice`].
/// Times are in milliseconds, distances in kilometers, speeds in km/h. Missing times are
/// [`NO_TIME`], missing measures are NaN.
///
/// The optional values (`moving_distance`, `total_time`, `moving_time`, `speed`, `time`, `hr`,
/// `cad`, `atemp`, `power`) are `None` when no trackpoint of the selection has one, and the OSM
/// attributes are stored as [`Intervals`]. The cumulative ones can only be missing before the
/// first trackpoint that has them, where they are 0.
#[derive(Debug, Default)]
pub struct StatisticsBuffer {
    /// Statistics of the whole selection.
    pub global: GlobalStatistics,
    pub total_distance: Vec<f64>,
    pub moving_distance: Option<Vec<f64>>,
    pub total_time: Option<Vec<i64>>,
    pub moving_time: Option<Vec<i64>>,
    pub speed: Option<Vec<f64>>,
    pub elevation_gain: Vec<f64>,
    pub elevation_loss: Vec<f64>,
    pub slope: Vec<f64>,
    pub slope_segment_slope: Vec<f64>,
    pub slope_segment_distance: Vec<f64>,
    pub lng: Vec<f64>,
    pub lat: Vec<f64>,
    pub ele: Vec<f64>,
    /// Timestamps, in milliseconds since the epoch.
    pub time: Option<Vec<i64>>,
    pub hr: Option<Vec<f64>>,
    pub cad: Option<Vec<f64>>,
    pub atemp: Option<Vec<f64>>,
    pub power: Option<Vec<f64>>,
    /// Surface of the trackpoints, see [`Intervals`].
    pub surface: Intervals,
    /// Highway of the trackpoints, as the surface.
    pub highway: Intervals,
    /// SAC hiking scale of the trackpoints, as the surface.
    pub sac_scale: Intervals,
    /// Mountain biking scale of the trackpoints, as the surface.
    pub mtb_scale: Intervals,
}

/// A value per trackpoint that rarely changes from one trackpoint to the next, stored as the
/// intervals of trackpoints that share it.
///
/// The values are 0 when unknown, else 1 + the code in the categories of the engine (so that it
/// is never 0 for a known value). `starts[i]` is the index of the first trackpoint of the
/// interval `i`, which ends where the next one starts, or at the last trackpoint for the last one.
/// Both are empty when there are no trackpoints.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Intervals {
    pub starts: Vec<u32>,
    pub values: Vec<u8>,
}

impl Intervals {
    fn clear(&mut self) {
        self.starts.clear();
        self.values.clear();
    }

    /// Adds the value of the trackpoint at `index`, the indices being pushed in order.
    fn push(&mut self, index: usize, value: u8) {
        if self.values.last() != Some(&value) {
            self.starts.push(index as u32);
            self.values.push(value);
        }
    }
}

/// 0 for an unknown value, else the code plus one. The categories hold at most 255 values, so it
/// fits.
fn unknown_or_next(code: Option<u8>) -> u8 {
    code.and_then(|code| code.checked_add(1)).unwrap_or(0)
}

/// Adds the value of the trackpoint at `index` to an optional column, the indices being pushed in
/// order. The column is created at the first present value, the previous trackpoints getting
/// `missing`.
fn push_optional<T: Copy>(column: &mut Option<Vec<T>>, index: usize, value: Option<T>, missing: T) {
    match (column.as_mut(), value) {
        (Some(column), value) => column.push(value.unwrap_or(missing)),
        (None, Some(value)) => {
            let mut new_column = vec![missing; index];
            new_column.push(value);
            *column = Some(new_column);
        }
        (None, None) => {}
    }
}

impl StatisticsBuffer {
    pub fn len(&self) -> usize {
        self.total_distance.len()
    }

    pub fn is_empty(&self) -> bool {
        self.total_distance.is_empty()
    }

    /// `selected`: the segments and their statistics, in order.
    pub fn update(&mut self, selected: &[(&TrackSegment, &Statistics)]) {
        self.global = GlobalStatistics::default();
        self.total_distance.clear();
        self.moving_distance = None;
        self.total_time = None;
        self.moving_time = None;
        self.speed = None;
        self.elevation_gain.clear();
        self.elevation_loss.clear();
        self.slope.clear();
        self.slope_segment_slope.clear();
        self.slope_segment_distance.clear();
        self.lng.clear();
        self.lat.clear();
        self.ele.clear();
        self.time = None;
        self.hr = None;
        self.cad = None;
        self.atemp = None;
        self.power = None;
        self.surface.clear();
        self.highway.clear();
        self.sac_scale.clear();
        self.mtb_scale.clear();

        for (segment, stats) in selected {
            for (trkpt, trkpt_stats) in segment.iter().zip(stats.local.iter()) {
                let index = self.total_distance.len();
                let cumul_stats = &self.global;
                self.total_distance
                    .push(cumul_stats.total_distance + trkpt_stats.total_distance);
                push_optional(
                    &mut self.moving_distance,
                    index,
                    sum_options(cumul_stats.moving_distance, trkpt_stats.moving_distance),
                    0.0,
                );
                push_optional(
                    &mut self.total_time,
                    index,
                    sum_options(cumul_stats.total_time, trkpt_stats.total_time),
                    0,
                );
                push_optional(
                    &mut self.moving_time,
                    index,
                    sum_options(cumul_stats.moving_time, trkpt_stats.moving_time),
                    0,
                );
                push_optional(&mut self.speed, index, trkpt_stats.speed, f64::NAN);
                self.elevation_gain
                    .push(cumul_stats.elevation_gain + trkpt_stats.elevation_gain);
                self.elevation_loss
                    .push(cumul_stats.elevation_loss + trkpt_stats.elevation_loss);
                self.slope.push(trkpt_stats.slope);
                self.slope_segment_slope
                    .push(trkpt_stats.slope_segment.slope);
                self.slope_segment_distance
                    .push(trkpt_stats.slope_segment.distance);
                self.lng.push(trkpt.coordinates.lng);
                self.lat.push(trkpt.coordinates.lat);
                self.ele.push(trkpt.ele);
                push_optional(&mut self.time, index, trkpt.time, NO_TIME);
                push_optional(&mut self.hr, index, trkpt.hr.map(f64::from), f64::NAN);
                push_optional(&mut self.cad, index, trkpt.cad.map(f64::from), f64::NAN);
                push_optional(&mut self.atemp, index, trkpt.atemp.map(f64::from), f64::NAN);
                push_optional(&mut self.power, index, trkpt.power.map(f64::from), f64::NAN);
                self.surface.push(index, unknown_or_next(trkpt.surface));
                self.highway.push(index, unknown_or_next(trkpt.highway));
                self.sac_scale.push(index, unknown_or_next(trkpt.sac_scale));
                self.mtb_scale.push(index, unknown_or_next(trkpt.mtb_scale));
            }
            self.global.merge(&stats.global);
        }
    }

    /// Statistics of the trackpoints from `start` to `end` (both included) of the selection, for
    /// example the part of an elevation profile the user dragged over. `None` if the range is
    /// not inside the selection.
    ///
    /// It is done in constant time, from the cumulative values at both ends: the bounds and
    /// the averages are the ones of the whole selection, they are not computed for the range.
    pub fn slice(&self, start: usize, end: usize) -> Option<GlobalStatistics> {
        if start > end || end >= self.len() {
            return None;
        }

        let delta = |values: &[f64]| values[end] - values[start];
        // the total time is the span of the timestamps, which is negative where they go backwards
        let delta_time = |values: &[i64]| (values[end] - values[start]).max(0);
        let time = |i: usize| {
            let time = self.time.as_ref()?[i];
            (time != NO_TIME).then_some(time)
        };
        Some(GlobalStatistics {
            total_distance: delta(&self.total_distance),
            moving_distance: self.moving_distance.as_deref().map(delta),
            total_time: self.total_time.as_deref().map(delta_time),
            moving_time: self.moving_time.as_deref().map(delta_time),
            elevation_gain: delta(&self.elevation_gain),
            elevation_loss: delta(&self.elevation_loss),
            start_time: time(start),
            end_time: time(end),
            bounds: self.global.bounds,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::parse;

    use super::*;

    fn computed(path: &str) -> (TrackSegment, Statistics) {
        let data = std::fs::read(path).unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let segment = file.trk[0].trkseg[0].clone();
        let stats = Statistics::compute(&segment);
        (segment, stats)
    }

    /// The value of the trackpoint at `index`, 0 before the first interval.
    fn value_at(intervals: &Intervals, index: usize) -> u8 {
        match intervals
            .starts
            .partition_point(|start| *start as usize <= index)
        {
            0 => 0,
            next => intervals.values[next - 1],
        }
    }

    fn all_lengths(buffer: &StatisticsBuffer) -> Vec<usize> {
        vec![
            buffer.total_distance.len(),
            buffer.elevation_gain.len(),
            buffer.elevation_loss.len(),
            buffer.slope.len(),
            buffer.slope_segment_slope.len(),
            buffer.slope_segment_distance.len(),
            buffer.lng.len(),
            buffer.lat.len(),
            buffer.ele.len(),
        ]
    }

    #[test]
    fn test_empty() {
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[]);
        assert!(buffer.is_empty());
        assert!(buffer.speed.is_none());
        assert_eq!(buffer.global.total_distance, 0.0);
        assert!(buffer.slice(0, 0).is_none());
    }

    #[test]
    fn test_single_segment_matches_local_stats() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        let n = s.local.len();
        assert!(all_lengths(&buffer).iter().all(|len| *len == n));
        assert_eq!(buffer.len(), n);
        for (i, local) in s.local.iter().enumerate() {
            assert_eq!(buffer.total_distance[i], local.total_distance);
            assert_eq!(buffer.slope[i], local.slope);
        }
        // the trackpoints
        for (i, trkpt) in segment.iter().enumerate() {
            assert_eq!(buffer.lng[i], trkpt.coordinates.lng);
            assert_eq!(buffer.lat[i], trkpt.coordinates.lat);
            assert_eq!(buffer.ele[i], trkpt.ele);
        }
    }

    #[test]
    fn test_global_is_the_merge_of_the_segments() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);

        let global = &buffer.global;
        assert!((global.total_distance - 2.0 * s.global.total_distance).abs() < 1e-9);
        assert!((global.elevation_gain - 2.0 * s.global.elevation_gain).abs() < 1e-9);
        assert!((global.elevation_loss - 2.0 * s.global.elevation_loss).abs() < 1e-9);
        // and it is the last cumulative value of the points
        assert_eq!(
            global.total_distance,
            *buffer.total_distance.last().unwrap()
        );

        buffer.update(&[(&segment, &s)]);
        assert_eq!(buffer.global.total_distance, s.global.total_distance);
        buffer.update(&[]);
        assert_eq!(buffer.global.total_distance, 0.0);
    }

    #[test]
    fn test_distances_accumulate_over_segments() {
        let (segment, s) = computed("data/simple.gpx");
        let n = s.local.len();
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);

        assert_eq!(buffer.total_distance.len(), 2 * n);
        // the second segment starts where the first one ended
        assert_eq!(buffer.total_distance[n], s.global.total_distance);
        assert!((buffer.total_distance[2 * n - 1] - 2.0 * s.global.total_distance).abs() < 1e-9);
        assert!(buffer.total_distance.windows(2).all(|w| w[0] <= w[1]));
        assert!((buffer.elevation_gain[2 * n - 1] - 2.0 * s.global.elevation_gain).abs() < 1e-9);
    }

    #[test]
    fn test_total_time_accumulates_over_segments() {
        let (segment, s) = computed("data/with_time.gpx");
        let n = s.local.len();
        let duration = s.global.total_time.unwrap();
        assert!(duration > 0);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);

        let total_time = buffer.total_time.as_ref().unwrap();
        assert_eq!(total_time[n - 1], duration);
        assert_eq!(total_time[n], duration);
        assert_eq!(total_time[2 * n - 1], 2 * duration);
        assert!(total_time.windows(2).all(|w| w[0] <= w[1]));
        assert!(buffer.time.unwrap().iter().all(|t| *t != NO_TIME));
    }

    #[test]
    fn test_absent_optional_values_have_no_buffer() {
        let (segment, s) = computed("data/simple.gpx");
        assert!(segment.iter().all(|trkpt| trkpt.time.is_none()));
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        assert!(buffer.time.is_none());
        assert!(buffer.hr.is_none());
        assert!(buffer.cad.is_none());
        assert!(buffer.atemp.is_none());
        assert!(buffer.power.is_none());
        assert_eq!(buffer.global.total_time, None);
        assert_eq!(buffer.len(), s.local.len());
        // they need times
        assert!(buffer.speed.is_none());
        assert!(buffer.moving_distance.is_none());
        assert!(buffer.total_time.is_none());
        assert!(buffer.moving_time.is_none());
        // the slices do not need them
        let slice = buffer.slice(0, 2).unwrap();
        assert_eq!((slice.start_time, slice.end_time), (None, None));
    }

    #[test]
    fn test_present_optional_values_have_one_entry_per_trackpoint() {
        let (segment, s) = computed("data/with_time.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        assert_eq!(buffer.time.as_ref().unwrap().len(), buffer.len());
        assert!(buffer.hr.is_none());

        let data = std::fs::read("data/with_hr.gpx").unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let segment = file.trk[0].trkseg[0].clone();
        let s = Statistics::compute(&segment);
        buffer.update(&[(&segment, &s)]);
        let hr = buffer.hr.as_ref().unwrap();
        assert_eq!(hr.len(), buffer.len());
        assert!(hr.iter().any(|v| !v.is_nan()));
    }

    #[test]
    fn test_a_value_missing_for_some_trackpoints_is_a_sentinel() {
        let (mut segment, _) = computed("data/with_time.gpx");
        let n = segment.len();
        let mut point = segment[1].clone();
        point.time = None;
        point.hr = Some(120);
        segment.splice(1, 2, vec![point]);
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        let time = buffer.time.as_ref().unwrap();
        assert_eq!(time.len(), n);
        assert_eq!(time[1], NO_TIME);
        assert_ne!(time[0], NO_TIME);
        // the first trackpoint has no heart rate: it is filled once the first one is found
        let hr = buffer.hr.as_ref().unwrap();
        assert_eq!(hr.len(), n);
        assert_eq!(hr[1], 120.0);
        assert!(hr[0].is_nan() && hr[2].is_nan());
        assert!(buffer.cad.is_none());
    }

    #[test]
    fn test_cumulative_values_are_zero_before_the_first_one() {
        let (mut segment, _) = computed("data/with_time.gpx");
        let n = segment.len();
        let mut first = segment[0].clone();
        first.time = None;
        segment.splice(0, 1, vec![first]);
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        let total_time = buffer.total_time.as_ref().unwrap();
        assert_eq!(total_time.len(), n);
        assert_eq!(total_time[0], 0);
        assert_eq!(total_time[n - 1], s.global.total_time.unwrap());
        assert!(total_time.windows(2).all(|w| w[0] <= w[1]));
        // so a slice that starts on the first trackpoint is right
        assert_eq!(
            buffer.slice(0, n - 1).unwrap().total_time,
            s.global.total_time
        );
    }

    #[test]
    fn test_surface_and_highway_intervals() {
        let (segment, s) = computed("data/with_highway.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        // 0 for the trackpoints that have none, else the code of the engine plus one
        let surface = &buffer.surface;
        assert_eq!(surface.starts, [0, 2, 3]);
        assert_eq!(surface.values, [1, 0, 2]);
        let highway = &buffer.highway;
        assert_eq!(
            (&highway.starts[..], &highway.values[..]),
            (&[0, 2, 3, 4][..], &[1, 0, 2, 0][..])
        );
        let sac_scale = &buffer.sac_scale;
        assert_eq!(
            (&sac_scale.starts[..], &sac_scale.values[..]),
            (&[0, 3, 4][..], &[0, 1, 2][..])
        );
        let mtb_scale = &buffer.mtb_scale;
        assert_eq!(
            (&mtb_scale.starts[..], &mtb_scale.values[..]),
            (&[0, 3][..], &[0, 1][..])
        );
        assert!(all_lengths(&buffer).iter().all(|len| *len == 5));

        // and they can be looked up
        let values: Vec<u8> = (0..6).map(|i| value_at(&buffer.surface, i)).collect();
        assert_eq!(values, [1, 1, 0, 2, 2, 2]);
    }

    #[test]
    fn test_intervals_merge_equal_neighbours_across_segments() {
        let (mut segment, _) = computed("data/simple.gpx");
        let points: Vec<_> = segment
            .iter()
            .map(|trkpt| {
                let mut trkpt = trkpt.clone();
                trkpt.surface = Some(4);
                trkpt
            })
            .collect();
        segment.splice(0, points.len(), points);
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);
        // one interval for the two segments
        assert_eq!(buffer.surface.starts, [0]);
        assert_eq!(buffer.surface.values, [5]);
        // and a single one of unknown values when nothing is known
        assert_eq!(buffer.highway.values, [0]);
    }

    #[test]
    fn test_codes_of_the_trackpoints_are_used_as_they_are() {
        let (mut segment, _) = computed("data/simple.gpx");
        let mut point = segment[0].clone();
        point.surface = Some(7);
        point.highway = Some(254);
        point.sac_scale = Some(0);
        point.mtb_scale = Some(3);
        segment.splice(0, 1, vec![point]);
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        let at = |i: usize| {
            (
                value_at(&buffer.surface, i),
                value_at(&buffer.highway, i),
                value_at(&buffer.sac_scale, i),
                value_at(&buffer.mtb_scale, i),
            )
        };
        assert_eq!(at(0), (8, 255, 1, 4));
        assert_eq!(at(1), (0, 0, 0, 0));
    }

    #[test]
    fn test_unknown_intervals_without_surface_and_highway() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        // a single interval of unknown values
        assert_eq!(buffer.surface.starts, [0]);
        assert_eq!(buffer.surface.values, [0]);
        assert_eq!(buffer.highway.starts, [0]);
        assert_eq!(buffer.highway.values, [0]);
        assert_eq!(buffer.sac_scale.values, [0]);
        assert_eq!(buffer.mtb_scale.values, [0]);
        // and they are reset by the next update
        buffer.update(&[]);
        assert_eq!(buffer.surface, Intervals::default());
        assert_eq!(buffer.highway, Intervals::default());
        assert_eq!(buffer.sac_scale, Intervals::default());
        assert_eq!(buffer.mtb_scale, Intervals::default());
        assert_eq!(value_at(&buffer.surface, 0), 0);
    }

    #[test]
    fn test_update_replaces_previous_content() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        buffer.update(&[(&segment, &s)]);
        assert_eq!(buffer.total_distance.len(), s.local.len());
        assert!(all_lengths(&buffer).iter().all(|len| *len == s.local.len()));
        buffer.update(&[]);
        assert!(buffer.total_distance.is_empty());
        assert!(all_lengths(&buffer).iter().all(|len| *len == 0));
    }

    #[test]
    fn test_slice_of_the_whole_selection_is_the_global_statistics() {
        let (segment, s) = computed("data/with_time.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);

        let slice = buffer.slice(0, buffer.len() - 1).unwrap();
        let global = &buffer.global;
        assert!((slice.total_distance - global.total_distance).abs() < 1e-9);
        assert!((slice.elevation_gain - global.elevation_gain).abs() < 1e-9);
        assert!((slice.elevation_loss - global.elevation_loss).abs() < 1e-9);
        assert_eq!(slice.total_time, global.total_time);
        assert_eq!(slice.moving_time, global.moving_time);
        assert_eq!(slice.start_time, global.start_time);
        assert_eq!(slice.end_time, global.end_time);
    }

    #[test]
    fn test_slices_of_corrupt_timestamps_are_never_negative_nor_infinite() {
        let (mut segment, _) = computed("data/with_time.gpx");
        let n = segment.len();
        assert!(n > 40);
        // timestamps that go back, then forward, and some that are missing
        let times: Vec<_> = segment.iter().map(|p| p.time.unwrap()).collect();
        segment.update_all(|i, pt| {
            pt.time = match i {
                10..=19 => Some(times[29 - i]),
                20..=24 => None,
                25..=29 => Some(times[0] - 1_000 * i as i64),
                _ => pt.time,
            };
        });
        let stats = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &stats)]);

        for start in 0..n {
            for end in start..n {
                let slice = buffer.slice(start, end).unwrap();
                for time in [slice.total_time, slice.moving_time].into_iter().flatten() {
                    assert!(time >= 0, "time of {start}..={end}");
                }
                for speed in [slice.total_speed(), slice.moving_speed()]
                    .into_iter()
                    .flatten()
                {
                    assert!(
                        speed.is_finite() && speed >= 0.0,
                        "speed of {start}..={end}"
                    );
                }
            }
        }
    }

    #[test]
    fn test_slice_of_a_range() {
        let (segment, s) = computed("data/with_time.gpx");
        let n = s.local.len();
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        let (start, end) = (n / 4, n / 2);
        let slice = buffer.slice(start, end).unwrap();
        assert!(
            (slice.total_distance - (buffer.total_distance[end] - buffer.total_distance[start]))
                .abs()
                < 1e-12
        );
        assert_eq!(
            slice.total_time,
            Some(
                buffer.total_time.as_ref().unwrap()[end]
                    - buffer.total_time.as_ref().unwrap()[start]
            )
        );
        assert_eq!(
            slice.moving_time,
            Some(
                buffer.moving_time.as_ref().unwrap()[end]
                    - buffer.moving_time.as_ref().unwrap()[start]
            )
        );
        assert_eq!(slice.start_time, Some(buffer.time.as_ref().unwrap()[start]));
        assert_eq!(slice.end_time, Some(buffer.time.as_ref().unwrap()[end]));
        assert!(slice.total_distance < buffer.global.total_distance);
        assert!(slice.total_speed().is_some());

        // a single point has nothing between its ends
        let point = buffer.slice(start, start).unwrap();
        assert_eq!(point.total_distance, 0.0);
        assert_eq!(point.total_time, Some(0));
    }

    #[test]
    fn test_slice_keeps_the_bounds_of_the_selection() {
        let data = std::fs::read("data/with_hr.gpx").unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let segment = file.trk[0].trkseg[0].clone();
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        let slice = buffer.slice(1, 3).unwrap();
        let (global, bounds) = (&buffer.global, &slice.bounds);
        assert_eq!(
            (bounds.sw.lng, bounds.sw.lat),
            (global.bounds.sw.lng, global.bounds.sw.lat)
        );
        assert_eq!(
            (bounds.ne.lng, bounds.ne.lat),
            (global.bounds.ne.lng, global.bounds.ne.lat)
        );
    }

    #[test]
    fn test_durations_are_not_limited_to_24_days() {
        // 30 days of recording, in milliseconds
        let (segment, mut s) = computed("data/with_time.gpx");
        let month = 30 * 24 * 3_600_000_i64;
        s.global.total_time = Some(month);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);
        assert_eq!(buffer.global.total_time, Some(2 * month));
        assert!(2 * month > i64::from(i32::MAX));
    }

    #[test]
    fn test_slice_across_segments() {
        let (segment, s) = computed("data/simple.gpx");
        let n = s.local.len();
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s), (&segment, &s)]);

        // from the middle of the first segment to the middle of the second one
        let slice = buffer.slice(n / 2, n + n / 2).unwrap();
        let expected = buffer.total_distance[n + n / 2] - buffer.total_distance[n / 2];
        assert!((slice.total_distance - expected).abs() < 1e-9);
        assert_eq!(slice.total_time, None);
    }

    #[test]
    fn test_slice_out_of_range() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        let n = buffer.len();
        assert!(buffer.slice(0, n).is_none());
        assert!(buffer.slice(n, n).is_none());
        assert!(buffer.slice(5, 4).is_none());
        assert!(buffer.slice(0, n - 1).is_some());
    }
}
