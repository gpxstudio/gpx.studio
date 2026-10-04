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
#[derive(Debug, Default)]
pub struct StatisticsBuffer {
    /// Statistics of the whole selection.
    pub global: GlobalStatistics,
    pub total_distance: Vec<f64>,
    pub moving_distance: Vec<f64>,
    pub total_time: Vec<i64>,
    pub moving_time: Vec<i64>,
    pub speed: Vec<f64>,
    pub elevation_gain: Vec<f64>,
    pub elevation_loss: Vec<f64>,
    pub slope: Vec<f64>,
    pub slope_segment_slope: Vec<f64>,
    pub slope_segment_distance: Vec<f64>,
    pub lng: Vec<f64>,
    pub lat: Vec<f64>,
    pub ele: Vec<f64>,
    /// Timestamps, in milliseconds since the epoch.
    pub time: Vec<i64>,
    pub hr: Vec<f64>,
    pub cad: Vec<f64>,
    pub atemp: Vec<f64>,
    pub power: Vec<f64>,
    /// Surface of the trackpoints: 0 when unknown, else 1 + its code in the categories of the
    /// engine (so that it is never 0 for a known surface).
    pub surface: Vec<u8>,
    /// Highway of the trackpoints, as the surface.
    pub highway: Vec<u8>,
    /// SAC hiking scale of the trackpoints, as the surface.
    pub sac_scale: Vec<u8>,
    /// Mountain biking scale of the trackpoints, as the surface.
    pub mtb_scale: Vec<u8>,
}

/// 0 for an unknown value, else the code plus one. The categories hold at most 255 values, so it
/// fits.
fn unknown_or_next(code: Option<u8>) -> u8 {
    code.and_then(|code| code.checked_add(1)).unwrap_or(0)
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
        self.moving_distance.clear();
        self.total_time.clear();
        self.moving_time.clear();
        self.speed.clear();
        self.elevation_gain.clear();
        self.elevation_loss.clear();
        self.slope.clear();
        self.slope_segment_slope.clear();
        self.slope_segment_distance.clear();
        self.lng.clear();
        self.lat.clear();
        self.ele.clear();
        self.time.clear();
        self.hr.clear();
        self.cad.clear();
        self.atemp.clear();
        self.power.clear();
        self.surface.clear();
        self.highway.clear();
        self.sac_scale.clear();
        self.mtb_scale.clear();

        let optional = |value: Option<f64>| value.unwrap_or(f64::NAN);

        for (segment, stats) in selected {
            for (trkpt, trkpt_stats) in segment.iter().zip(stats.local.iter()) {
                let cumul_stats = &self.global;
                self.total_distance
                    .push(cumul_stats.total_distance + trkpt_stats.total_distance);
                self.moving_distance.push(
                    sum_options(cumul_stats.moving_distance, trkpt_stats.moving_distance)
                        .unwrap_or_default(),
                );
                self.total_time.push(
                    sum_options(cumul_stats.total_time, trkpt_stats.total_time).unwrap_or_default(),
                );
                self.moving_time.push(
                    sum_options(cumul_stats.moving_time, trkpt_stats.moving_time)
                        .unwrap_or_default(),
                );
                self.speed.push(trkpt_stats.speed.unwrap_or_default());
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
                self.time.push(trkpt.time.unwrap_or(NO_TIME));
                self.hr.push(optional(trkpt.hr.map(f64::from)));
                self.cad.push(optional(trkpt.cad.map(f64::from)));
                self.atemp.push(optional(trkpt.atemp.map(f64::from)));
                self.power.push(optional(trkpt.power.map(f64::from)));
                self.surface.push(unknown_or_next(trkpt.surface));
                self.highway.push(unknown_or_next(trkpt.highway));
                self.sac_scale.push(unknown_or_next(trkpt.sac_scale));
                self.mtb_scale.push(unknown_or_next(trkpt.mtb_scale));
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
        let delta_time = |values: &[i64]| values[end] - values[start];
        let time = |i: usize| (self.time[i] != NO_TIME).then_some(self.time[i]);
        Some(GlobalStatistics {
            total_distance: delta(&self.total_distance),
            moving_distance: self
                .global
                .moving_distance
                .map(|_| delta(&self.moving_distance)),
            total_time: self.global.total_time.map(|_| delta_time(&self.total_time)),
            moving_time: self
                .global
                .moving_time
                .map(|_| delta_time(&self.moving_time)),
            elevation_gain: delta(&self.elevation_gain),
            elevation_loss: delta(&self.elevation_loss),
            start_time: time(start),
            end_time: time(end),
            bounds: self.global.bounds,
            hr: self.global.hr,
            cad: self.global.cad,
            atemp: self.global.atemp,
            power: self.global.power,
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

    fn all_lengths(buffer: &StatisticsBuffer) -> Vec<usize> {
        vec![
            buffer.total_distance.len(),
            buffer.moving_distance.len(),
            buffer.total_time.len(),
            buffer.moving_time.len(),
            buffer.speed.len(),
            buffer.elevation_gain.len(),
            buffer.elevation_loss.len(),
            buffer.slope.len(),
            buffer.slope_segment_slope.len(),
            buffer.slope_segment_distance.len(),
            buffer.lng.len(),
            buffer.lat.len(),
            buffer.ele.len(),
            buffer.time.len(),
            buffer.hr.len(),
            buffer.cad.len(),
            buffer.atemp.len(),
            buffer.power.len(),
            buffer.surface.len(),
            buffer.highway.len(),
            buffer.sac_scale.len(),
            buffer.mtb_scale.len(),
        ]
    }

    #[test]
    fn test_empty() {
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[]);
        assert!(buffer.is_empty());
        assert!(buffer.speed.is_empty());
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

        assert_eq!(buffer.total_time[n - 1], duration);
        assert_eq!(buffer.total_time[n], duration);
        assert_eq!(buffer.total_time[2 * n - 1], 2 * duration);
        assert!(buffer.total_time.windows(2).all(|w| w[0] <= w[1]));
        assert!(buffer.time.iter().all(|t| *t != NO_TIME));
    }

    #[test]
    fn test_missing_times_and_measures_are_nan() {
        let (segment, s) = computed("data/simple.gpx");
        assert!(segment.iter().all(|trkpt| trkpt.time.is_none()));
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        assert!(buffer.time.iter().all(|t| *t == NO_TIME));
        assert!(buffer.hr.iter().all(|v| v.is_nan()));
        assert_eq!(buffer.global.hr.count, 0);
        assert_eq!(buffer.global.total_time, None);
    }

    #[test]
    fn test_surface_and_highway_codes() {
        let (segment, s) = computed("data/with_highway.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);

        // 0 for the trackpoints that have none, else the code of the engine plus one
        assert_eq!(buffer.surface, [1, 1, 0, 2, 2]);
        assert_eq!(buffer.highway, [1, 1, 0, 2, 0]);
        assert_eq!(buffer.sac_scale, [0, 0, 0, 1, 2]);
        assert_eq!(buffer.mtb_scale, [0, 0, 0, 1, 1]);
        assert!(all_lengths(&buffer).iter().all(|len| *len == 5));
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
        assert_eq!((buffer.surface[0], buffer.highway[0]), (8, 255));
        assert_eq!((buffer.sac_scale[0], buffer.mtb_scale[0]), (1, 4));
        assert_eq!((buffer.surface[1], buffer.highway[1]), (0, 0));
        assert_eq!((buffer.sac_scale[1], buffer.mtb_scale[1]), (0, 0));
    }

    #[test]
    fn test_no_codes_without_surface_and_highway() {
        let (segment, s) = computed("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        assert_eq!(buffer.surface.len(), s.local.len());
        assert!(buffer.surface.iter().all(|c| *c == 0));
        assert!(buffer.highway.iter().all(|c| *c == 0));
        assert!(buffer.sac_scale.iter().all(|c| *c == 0));
        assert!(buffer.mtb_scale.iter().all(|c| *c == 0));
        // and they are reset by the next update
        buffer.update(&[]);
        assert!(buffer.surface.is_empty() && buffer.highway.is_empty());
        assert!(buffer.sac_scale.is_empty() && buffer.mtb_scale.is_empty());
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
            Some(buffer.total_time[end] - buffer.total_time[start])
        );
        assert_eq!(
            slice.moving_time,
            Some(buffer.moving_time[end] - buffer.moving_time[start])
        );
        assert_eq!(slice.start_time, Some(buffer.time[start]));
        assert_eq!(slice.end_time, Some(buffer.time[end]));
        assert!(slice.total_distance < buffer.global.total_distance);
        assert!(slice.total_speed().is_some());

        // a single point has nothing between its ends
        let point = buffer.slice(start, start).unwrap();
        assert_eq!(point.total_distance, 0.0);
        assert_eq!(point.total_time, Some(0));
    }

    #[test]
    fn test_slice_keeps_the_bounds_and_averages_of_the_selection() {
        let data = std::fs::read("data/with_hr.gpx").unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let segment = file.trk[0].trkseg[0].clone();
        let s = Statistics::compute(&segment);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[(&segment, &s)]);
        assert!(buffer.global.hr.count > 0);

        let slice = buffer.slice(1, 3).unwrap();
        let (global, bounds) = (&buffer.global, &slice.bounds);
        assert_eq!(slice.hr, global.hr);
        assert_eq!(slice.cad, global.cad);
        assert_eq!(slice.atemp, global.atemp);
        assert_eq!(slice.power, global.power);
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
