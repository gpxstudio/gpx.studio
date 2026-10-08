use crate::{
    LngLat, LngLatBounds, TrackSegment, TrackSegmentIndex, Trackpoint, distance, for_each_window,
    max_options, min_options, ramer_douglas_peucker, slope, speed, sum_options, time_diff,
};

/// Time between two trackpoints, to size the windows of a smoothing. It is unknown when one of
/// them has no time, which is longer than any known time span: the window does not go there.
#[derive(Clone, Copy, PartialEq, PartialOrd)]
enum TimeSpan {
    Known(i64),
    Unknown,
}

impl TimeSpan {
    fn between(end: Option<i64>, start: Option<i64>) -> Self {
        time_diff(end, start).map_or(Self::Unknown, Self::Known)
    }
}

#[derive(Default, Debug)]
pub struct Statistics {
    pub global: GlobalStatistics,
    pub local: Vec<TrackpointStatistics>,
}

impl Statistics {
    pub fn total_speed(&self) -> Option<f64> {
        self.global.total_speed()
    }

    pub fn moving_speed(&self) -> Option<f64> {
        self.global.moving_speed()
    }

    pub fn compute(trkseg: &TrackSegment) -> Self {
        let mut stats = Self::default();
        if trkseg.is_empty() {
            return stats;
        }

        let mut prev = &trkseg[0];
        for cur in trkseg.iter() {
            stats.accumulate(prev, cur);
            prev = cur;
        }

        stats.compute_smoothed_speed(trkseg);
        stats.compute_smoothed_elevation_segments(trkseg);
        stats.compute_smoothed_slope(trkseg);

        stats
    }

    fn accumulate(&mut self, prev: &Trackpoint, cur: &Trackpoint) {
        self.accumulate_distance_and_time(prev, cur);
        self.update_time_bounds(cur.time);
        self.update_bounds(cur.coordinates);
        self.global.hr.add(cur.hr.map(f64::from));
        self.global.cad.add(cur.cad.map(f64::from));
        self.global.atemp.add(cur.atemp.map(f64::from));
        self.global.power.add(cur.power.map(f64::from));
        self.local
            .push(TrackpointStatistics::from_partial_stats(self));
    }

    fn accumulate_distance_and_time(&mut self, prev: &Trackpoint, cur: &Trackpoint) {
        let dist = distance(prev.coordinates, cur.coordinates);
        let time = time_diff(cur.time, prev.time);

        self.global.total_distance += dist;

        if let Some(time) = time {
            let speed = speed(dist, time);
            if (0.5..=1500.0).contains(&speed) {
                self.global.moving_distance = self
                    .global
                    .moving_distance
                    .map_or(Some(dist), |d| Some(d + dist));
                self.global.moving_time = self
                    .global
                    .moving_time
                    .map_or(Some(time), |t| Some(t + time));
            }
        }
    }

    fn update_time_bounds(&mut self, time: Option<i64>) {
        if let Some(time) = time {
            if self.global.start_time.is_none() {
                self.global.start_time = Some(time);
            }
            self.global.end_time = Some(time);
            self.global.total_time = time_diff(self.global.end_time, self.global.start_time);
        }
    }

    fn update_bounds(&mut self, coordinates: LngLat) {
        self.global.bounds.extend(coordinates);
    }

    /// Speed over a window of 10 seconds on each side of the trackpoints that have a time (the
    /// others have no speed). The windows do not extend to the trackpoints without time: if the
    /// previous or next trackpoint has none, the window ends at the trackpoint itself on that side.
    fn compute_smoothed_speed(&mut self, trkseg: &TrackSegment) {
        for_each_window!(
            trkseg,
            trkseg.first_index(),
            trkseg.last_index(),
            TimeSpan::Known(10_000),
            |i, j| TimeSpan::between(trkseg[j].time, trkseg[i].time),
            |i, left, right| {
                if trkseg[i].time.is_some() {
                    let timed = |index: TrackSegmentIndex| {
                        if trkseg[index].time.is_some() {
                            index
                        } else {
                            i
                        }
                    };
                    let (left, right) = (timed(left), timed(right));
                    self.local[i.flat].speed = time_diff(trkseg[right].time, trkseg[left].time)
                        .filter(|time| *time > 0)
                        .map(|time| {
                            speed(
                                self.local[right.flat].total_distance
                                    - self.local[left.flat].total_distance,
                                time,
                            )
                        });
                }
            },
        );
    }

    fn compute_smoothed_elevation_segments(&mut self, trkseg: &TrackSegment) {
        let simplified = self.get_elevation_extremas(trkseg);

        for i in 0..(simplified.len() - 1) {
            let start = simplified[i];
            let end = simplified[i + 1];
            let last = i + 1 == simplified.len() - 1;

            self.compute_smoothed_elevation_gain(trkseg, start, end, last);

            let segment_dist =
                self.local[end.flat].total_distance - self.local[start.flat].total_distance;
            let segment_ele = trkseg[end].ele - trkseg[start].ele;
            let segment_slope = slope(segment_ele, segment_dist);
            for k in start.flat..(end.flat + last as usize) {
                self.local[k].slope_segment = SlopeSegment {
                    slope: segment_slope,
                    distance: segment_dist,
                };
            }
        }
    }

    fn compute_smoothed_elevation_gain(
        &mut self,
        trkseg: &TrackSegment,
        start: TrackSegmentIndex,
        end: TrackSegmentIndex,
        last: bool,
    ) {
        let mut cumul_ele = 0.0;
        let mut current_left = start;
        let mut current_right = Some(start);
        let mut prev_smoothed_ele = trkseg[start].ele;

        for_each_window!(
            trkseg,
            Some(start),
            Some(end),
            0.1,
            |i, j| self.local[j.flat].total_distance - self.local[i.flat].total_distance,
            |i, left, right| {
                while current_left != left {
                    cumul_ele -= trkseg[current_left].ele;
                    current_left = trkseg.next_index(Some(current_left)).unwrap();
                }
                while let Some(current) = current_right {
                    if current > right {
                        break;
                    }
                    cumul_ele += trkseg[current].ele;
                    current_right = trkseg.next_index(current_right);
                }

                let smoothed_ele = if i == start || i == end {
                    trkseg[i].ele
                } else {
                    cumul_ele / (right.flat - left.flat + 1) as f64
                };

                let delta = smoothed_ele - prev_smoothed_ele;
                if delta > 0.0 {
                    self.global.elevation_gain += delta;
                } else if delta < 0.0 {
                    self.global.elevation_loss -= delta;
                }

                if i < end || last {
                    self.local[i.flat].elevation_gain = self.global.elevation_gain;
                    self.local[i.flat].elevation_loss = self.global.elevation_loss;
                }

                prev_smoothed_ele = smoothed_ele;
            },
        );
    }

    fn compute_smoothed_slope(&mut self, trkseg: &TrackSegment) {
        for_each_window!(
            trkseg,
            trkseg.first_index(),
            trkseg.last_index(),
            0.05,
            |i, j| self.local[j.flat].total_distance - self.local[i.flat].total_distance,
            |i, left, right| {
                let dist =
                    self.local[right.flat].total_distance - self.local[left.flat].total_distance;
                let ele = trkseg[right].ele - trkseg[left].ele;
                self.local[i.flat].slope = slope(ele, dist);
            },
        );
    }

    fn get_elevation_extremas(&self, trkseg: &TrackSegment) -> Vec<TrackSegmentIndex> {
        ramer_douglas_peucker(
            trkseg,
            &|idx| {
                (
                    self.local[idx.flat].total_distance * 1000.0,
                    trkseg[idx].ele,
                )
            },
            20.0,
        )
    }
}

/// Average of an optional measure (heart rate, cadence...) over the trackpoints that have it.
/// Keeps the sum so that averages can be merged.
#[derive(Default, Debug, Clone, Copy, PartialEq)]
pub struct Average {
    pub sum: f64,
    pub count: u32,
}

impl Average {
    pub fn add(&mut self, value: Option<f64>) {
        if let Some(value) = value {
            self.sum += value;
            self.count += 1;
        }
    }

    pub fn merge(&mut self, other: &Average) {
        self.sum += other.sum;
        self.count += other.count;
    }

    pub fn avg(&self) -> Option<f64> {
        (self.count > 0).then(|| self.sum / self.count as f64)
    }
}

#[derive(Default, Debug)]
pub struct GlobalStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub total_time: Option<i64>,
    pub moving_time: Option<i64>,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub bounds: LngLatBounds,
    pub hr: Average,
    pub cad: Average,
    pub atemp: Average,
    pub power: Average,
}

impl GlobalStatistics {
    /// Average speed over the total time, unknown if that is not a positive duration (for
    /// example a range with a single timestamp, or timestamps going backwards).
    pub fn total_speed(&self) -> Option<f64> {
        self.total_time
            .filter(|t| *t > 0)
            .map(|t| speed(self.total_distance, t))
    }

    /// Average speed over the moving time, unknown if there is no moving time.
    pub fn moving_speed(&self) -> Option<f64> {
        self.moving_distance
            .zip(self.moving_time.filter(|t| *t > 0))
            .map(|(d, t)| speed(d, t))
    }

    pub fn merge(&mut self, other: &GlobalStatistics) {
        self.total_distance += other.total_distance;
        self.moving_distance = sum_options(self.moving_distance, other.moving_distance);
        self.total_time = sum_options(self.total_time, other.total_time);
        self.moving_time = sum_options(self.moving_time, other.moving_time);
        self.elevation_gain += other.elevation_gain;
        self.elevation_loss += other.elevation_loss;
        self.start_time = min_options(self.start_time, other.start_time);
        self.end_time = max_options(self.end_time, other.end_time);
        self.bounds.merge(&other.bounds);
        self.hr.merge(&other.hr);
        self.cad.merge(&other.cad);
        self.atemp.merge(&other.atemp);
        self.power.merge(&other.power);
    }
}

#[derive(Default, Debug)]
pub struct TrackpointStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub total_time: Option<i64>,
    pub moving_time: Option<i64>,
    pub speed: Option<f64>,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub slope: f64,
    pub slope_segment: SlopeSegment,
}

impl TrackpointStatistics {
    fn from_partial_stats(stats: &Statistics) -> Self {
        Self {
            total_distance: stats.global.total_distance,
            moving_distance: stats.global.moving_distance,
            total_time: stats.global.total_time,
            moving_time: stats.global.moving_time,
            // stats below are computed later
            speed: None,
            elevation_gain: Default::default(),
            elevation_loss: Default::default(),
            slope: Default::default(),
            slope_segment: Default::default(),
        }
    }
}

#[derive(Default, Debug)]
pub struct SlopeSegment {
    pub slope: f64,
    pub distance: f64,
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Read};

    use crate::parse;

    use super::*;

    #[test]
    fn test_compute_smoothed_speed() {
        let mut f = File::open("data/with_time.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        let gpx = parse(data.as_bytes(), &mut Default::default()).unwrap();

        let trkseg = &gpx.trk[0].trkseg[0];
        let stats = Statistics::compute(trkseg);
        assert_eq!(stats.local.len(), trkseg.len());
        for trkpt_stats in stats.local.iter() {
            assert!(trkpt_stats.speed.is_some());
            let speed = trkpt_stats.speed.unwrap();
            assert_ne!(speed, f64::NAN);
            assert!((speed - 20.0).abs() < 0.1);
        }
    }

    /// The speeds of the segment of `data/with_time.gpx` (80 trackpoints at 20 km/h) once the
    /// trackpoints at `holes` have lost their time.
    fn speeds_with_holes(holes: &[usize]) -> Vec<Option<f64>> {
        let gpx = load("data/with_time.gpx");
        let mut segment = gpx.trk[0].trkseg[0].clone();
        let points: Vec<_> = segment
            .iter()
            .enumerate()
            .map(|(i, trkpt)| {
                let mut trkpt = trkpt.clone();
                if holes.contains(&i) {
                    trkpt.time = None;
                }
                trkpt
            })
            .collect();
        segment.splice(0, points.len(), points);
        Statistics::compute(&segment)
            .local
            .iter()
            .map(|local| local.speed)
            .collect()
    }

    /// Without time, there is no speed. With one, the speed is the one of the trackpoints around.
    fn assert_speeds_with_holes(holes: &[usize]) {
        let speeds = speeds_with_holes(holes);
        assert_eq!(speeds.len(), 80);
        for (i, speed) in speeds.iter().enumerate() {
            if holes.contains(&i) {
                assert_eq!(*speed, None, "trackpoint {i}");
            } else {
                let speed = speed.unwrap_or_else(|| panic!("no speed for trackpoint {i}"));
                assert!((speed - 20.0).abs() < 0.1, "trackpoint {i}: {speed}");
            }
        }
    }

    #[test]
    fn test_speed_without_holes() {
        assert_speeds_with_holes(&[]);
    }

    #[test]
    fn test_speed_with_holes_at_the_beginning() {
        assert_speeds_with_holes(&[0, 1, 2, 3, 4]);
    }

    #[test]
    fn test_speed_with_holes_at_the_end() {
        assert_speeds_with_holes(&[75, 76, 77, 78, 79]);
    }

    #[test]
    fn test_speed_with_holes_at_both_ends() {
        assert_speeds_with_holes(&[0, 1, 2, 77, 78, 79]);
    }

    #[test]
    fn test_speed_with_holes_in_the_middle() {
        assert_speeds_with_holes(&[40]);
        assert_speeds_with_holes(&[30, 31, 32, 33, 34]);
        assert_speeds_with_holes(&(20..60).collect::<Vec<_>>());
    }

    #[test]
    fn test_speed_with_scattered_holes() {
        let holes: Vec<_> = (0..80).step_by(7).collect();
        assert_speeds_with_holes(&holes);
    }

    #[test]
    fn test_speed_without_any_time() {
        let holes: Vec<_> = (0..80).collect();
        assert!(speeds_with_holes(&holes).iter().all(Option::is_none));
    }

    fn load(path: &str) -> crate::File {
        let mut f = File::open(path).unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        parse(data.as_bytes(), &mut Default::default()).unwrap()
    }

    #[test]
    fn test_compute_empty_segment() {
        let stats = Statistics::compute(&TrackSegment::default());
        assert!(stats.local.is_empty());
        assert_eq!(stats.global.total_distance, 0.0);
    }

    #[test]
    fn test_compute_distance_and_bounds() {
        let gpx = load("data/simple.gpx");
        let trkseg = &gpx.trk[0].trkseg[0];
        let stats = Statistics::compute(trkseg);

        assert_eq!(stats.local.len(), trkseg.len());
        assert_eq!(stats.local[0].total_distance, 0.0);
        assert!(stats.global.total_distance > 0.0);
        // cumulative distance never decreases and ends at the global distance
        assert!(
            stats
                .local
                .windows(2)
                .all(|w| w[0].total_distance <= w[1].total_distance)
        );
        let last = stats.local.last().unwrap();
        assert!((last.total_distance - stats.global.total_distance).abs() < 1e-9);
        assert!(stats.global.elevation_gain >= 0.0);
        assert!(stats.global.elevation_loss >= 0.0);

        // every point lies inside the bounds
        let b = &stats.global.bounds;
        for trkpt in trkseg.iter() {
            assert!(b.sw.lng <= trkpt.coordinates.lng && trkpt.coordinates.lng <= b.ne.lng);
            assert!(b.sw.lat <= trkpt.coordinates.lat && trkpt.coordinates.lat <= b.ne.lat);
        }
    }

    #[test]
    fn test_compute_time() {
        let gpx = load("data/with_time.gpx");
        let stats = Statistics::compute(&gpx.trk[0].trkseg[0]);
        let total_time = stats.global.total_time.unwrap();
        assert!(total_time > 0);
        let speed = stats.global.total_speed().unwrap();
        assert!((speed - 20.0).abs() < 0.5, "{speed}");
    }

    #[test]
    fn test_no_time_without_timestamps() {
        let gpx = load("data/simple.gpx");
        let stats = Statistics::compute(&gpx.trk[0].trkseg[0]);
        assert!(stats.global.total_time.is_none());
        assert!(stats.global.total_speed().is_none());
        assert!(stats.local.iter().all(|s| s.speed.is_none()));
    }

    #[test]
    fn test_global_merge() {
        let mut a = GlobalStatistics {
            total_distance: 1.0,
            elevation_gain: 10.0,
            moving_time: Some(5),
            ..Default::default()
        };
        a.bounds.extend(crate::LngLat { lng: 0.0, lat: 0.0 });
        let mut b = GlobalStatistics {
            total_distance: 2.0,
            elevation_loss: 4.0,
            moving_distance: Some(1.5),
            moving_time: Some(7),
            ..Default::default()
        };
        b.bounds.extend(crate::LngLat { lng: 2.0, lat: 3.0 });

        a.merge(&b);
        assert_eq!(a.total_distance, 3.0);
        assert_eq!(a.elevation_gain, 10.0);
        assert_eq!(a.elevation_loss, 4.0);
        assert_eq!(a.moving_distance, Some(1.5));
        assert_eq!(a.moving_time, Some(12));
        assert_eq!(a.total_time, None);

        let mut c = GlobalStatistics {
            start_time: Some(1_000),
            end_time: Some(4_000),
            total_time: Some(3_000),
            ..Default::default()
        };
        let d = GlobalStatistics {
            start_time: Some(10_000),
            end_time: Some(12_000),
            total_time: Some(2_000),
            ..Default::default()
        };
        c.merge(&d);
        // 3 s + 2 s, the gap between the two is ignored
        assert_eq!(c.total_time, Some(5_000));
        let mut cumul = GlobalStatistics::default();
        cumul.merge(&c);
        cumul.merge(&d);
        assert_eq!(cumul.start_time, Some(1_000));
        assert_eq!(cumul.end_time, Some(12_000));
        assert_eq!(cumul.total_time, Some(7_000));
        assert_eq!((a.bounds.ne.lng, a.bounds.ne.lat), (2.0, 3.0));
    }

    #[test]
    fn test_average() {
        let mut average = Average::default();
        assert_eq!(average.avg(), None);
        average.add(None);
        assert_eq!(average.avg(), None);
        average.add(Some(100.0));
        average.add(Some(110.0));
        assert_eq!(average.avg(), Some(105.0));

        let mut other = Average::default();
        other.add(Some(130.0));
        average.merge(&other);
        assert_eq!(average.count, 3);
        assert_eq!(average.avg(), Some(113.33333333333333));
    }

    #[test]
    fn test_measures_of_the_trackpoints_are_averaged() {
        for (path, measure) in [
            ("data/with_hr.gpx", 0),
            ("data/with_cad.gpx", 1),
            ("data/with_temp.gpx", 2),
            ("data/with_power_1.gpx", 3),
        ] {
            let data = std::fs::read(path).unwrap();
            let gpx = parse(&data, &mut Default::default()).unwrap();
            let trkseg = &gpx.trk[0].trkseg[0];
            let global = Statistics::compute(trkseg).global;
            let values: Vec<f64> = trkseg
                .iter()
                .filter_map(|trkpt| match measure {
                    0 => trkpt.hr.map(f64::from),
                    1 => trkpt.cad.map(f64::from),
                    2 => trkpt.atemp.map(f64::from),
                    _ => trkpt.power.map(f64::from),
                })
                .collect();
            let average = [global.hr, global.cad, global.atemp, global.power][measure];
            assert!(!values.is_empty(), "{path}");
            assert_eq!(average.count as usize, values.len(), "{path}");
            let expected = values.iter().sum::<f64>() / values.len() as f64;
            assert!((average.avg().unwrap() - expected).abs() < 1e-9, "{path}");
        }
    }
}
