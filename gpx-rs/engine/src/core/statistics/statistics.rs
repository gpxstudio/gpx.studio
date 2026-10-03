use crate::{
    LngLat, LngLatBounds, TrackSegment, TrackSegmentIndex, Trackpoint, distance, for_each_window,
    max_options, min_options, ramer_douglas_peucker, slope, speed, sum_options, time_diff,
};

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

    fn compute_smoothed_speed(&mut self, trkseg: &TrackSegment) {
        for_each_window!(
            trkseg,
            trkseg.first_index(),
            trkseg.last_index(),
            Some(10000),
            |i, j| time_diff(trkseg[i].time, trkseg[j].time),
            |i, left, right| {
                self.local[i.flat].speed =
                    time_diff(trkseg[right].time, trkseg[left].time).map(|t| {
                        speed(
                            self.local[right.flat].total_distance
                                - self.local[left.flat].total_distance,
                            t,
                        )
                    });
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

#[derive(Default, Debug)]
pub struct GlobalStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub total_time: Option<i32>,
    pub moving_time: Option<i32>,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub bounds: LngLatBounds,
}

impl GlobalStatistics {
    pub fn total_speed(&self) -> Option<f64> {
        self.total_time.map(|t| speed(self.total_distance, t))
    }

    pub fn moving_speed(&self) -> Option<f64> {
        self.moving_distance
            .zip(self.moving_time)
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
    }
}

#[derive(Default, Debug)]
pub struct TrackpointStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub total_time: Option<i32>,
    pub moving_time: Option<i32>,
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
        let gpx = parse(data.as_bytes()).unwrap();

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

    fn load(path: &str) -> crate::File {
        let mut f = File::open(path).unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        parse(data.as_bytes()).unwrap()
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
}
