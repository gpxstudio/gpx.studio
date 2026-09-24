use std::ops::Add;

use crate::{
    algorithm::ramer_douglas_peucker,
    for_each_window,
    gpx::{LngLat, LngLatBounds, TrackSegment, Trackpoint},
    utils::{distance, slope, speed},
};

#[derive(Default, Debug)]
pub struct GPXStatistics {
    pub global: GlobalStatistics,
    pub local: Vec<TrackpointStatistics>,
}

impl GPXStatistics {
    pub fn total_time(&self) -> Option<i64> {
        self.global
            .start_time
            .zip(self.global.end_time)
            .map(|(t1, t2)| t2 - t1)
    }

    pub fn total_speed(&self) -> Option<f64> {
        self.total_time()
            .map(|t| speed(self.global.total_distance, t))
    }

    pub fn moving_speed(&self) -> Option<f64> {
        self.global
            .moving_distance
            .zip(self.global.moving_time)
            .map(|(d, t)| speed(d, t))
    }

    pub fn compute(trkseg: &TrackSegment) -> Self {
        let mut stats = Self::default();
        if trkseg.len() == 0 {
            return stats;
        }

        let mut prev = &trkseg[0];
        for cur in trkseg.iter() {
            stats.accumulate(prev, cur);
            prev = cur;
        }

        stats.compute_smoothed_speed(trkseg);
        stats.compute_smoothed_elevation_gain(trkseg);

        stats
    }

    fn accumulate(&mut self, prev: &Trackpoint, cur: &Trackpoint) {
        self.accumulate_distance_and_time(prev, cur);
        self.update_time_bounds(cur.time);
        self.update_bounds(cur.coordinates);
        self.local
            .push(TrackpointStatistics::from_partial_stats(&self));
    }

    fn accumulate_distance_and_time(&mut self, prev: &Trackpoint, cur: &Trackpoint) {
        let dist = distance(prev.coordinates, cur.coordinates);
        let time = cur.time_diff(prev);

        self.global.total_distance += dist;

        if let Some(time) = time {
            let speed = speed(dist, time);
            if speed >= 0.5 && speed <= 1500.0 {
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
            |i, j| trkseg[i].time_diff(&trkseg[j]),
            |i, left, right| {
                let i = trkseg.to_flat_index(i);
                let left = trkseg.to_flat_index(left);
                let right = trkseg.to_flat_index(right);
                self.local[i].speed = trkseg[right].time_diff(&trkseg[left]).map(|t| {
                    speed(
                        self.local[right].total_distance - self.local[left].total_distance,
                        t,
                    )
                });
            },
        );
    }

    fn compute_smoothed_elevation_gain(&mut self, trkseg: &TrackSegment) {
        let simplified = ramer_douglas_peucker(
            trkseg,
            &|i, j, k| {
                let x1 = self.local[trkseg.to_flat_index(i)].total_distance * 1000.0;
                let x2 = self.local[trkseg.to_flat_index(j)].total_distance * 1000.0;
                let x3 = self.local[trkseg.to_flat_index(k)].total_distance * 1000.0;
                let y1 = trkseg[i].ele;
                let y2 = trkseg[j].ele;
                let y3 = trkseg[k].ele;

                let dist = ((y2 - y1).powi(2) + (x2 - x1).powi(2)).sqrt();
                if dist == 0.0 {
                    ((x3 - x1).powi(2) + (y3 - y1).powi(2)).sqrt()
                } else {
                    ((y2 - y1) * x3 - (x2 - x1) * y3 + x2 * y1 - y2 * x1).abs() / dist
                }
            },
            20.0,
        );

        for i in 0..(simplified.len() - 1) {
            let start = simplified[i];
            let end = simplified[i + 1];
            let last = i + 1 == simplified.len() - 1;

            let mut cumul_ele = 0.0;
            let mut current_left = start;
            let mut current_right = Some(start);
            let mut prev_smoothed_ele = trkseg[start].ele;

            for_each_window!(
                trkseg,
                Some(start),
                Some(end),
                0.1,
                |i, j| {
                    let i = trkseg.to_flat_index(i);
                    let j = trkseg.to_flat_index(j);
                    self.local[j].total_distance - self.local[i].total_distance
                },
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

                    let flat_i = trkseg.to_flat_index(i);
                    let flat_left = trkseg.to_flat_index(left);
                    let flat_right = trkseg.to_flat_index(right);

                    let smoothed_ele: f64 = if i == start || i == end {
                        trkseg[i].ele
                    } else {
                        cumul_ele / (flat_right - flat_left + 1) as f64
                    };

                    let delta = smoothed_ele - prev_smoothed_ele;
                    if delta > 0.0 {
                        self.global.elevation_gain += delta;
                    } else if delta < 0.0 {
                        self.global.elevation_loss -= delta;
                    }

                    if i < end || last {
                        self.local[flat_i].elevation_gain = self.global.elevation_gain;
                        self.local[flat_i].elevation_loss = self.global.elevation_loss;
                    }

                    prev_smoothed_ele = smoothed_ele;
                },
            );

            let flat_start = trkseg.to_flat_index(start);
            let flat_end = trkseg.to_flat_index(end);

            let segment_dist =
                self.local[flat_end].total_distance - self.local[flat_start].total_distance;
            let segment_ele = trkseg[end].ele - trkseg[start].ele;
            let segment_slope = slope(segment_ele, segment_dist);
            for k in flat_start..(flat_end + last as usize) {
                self.local[k].slope_segment = SlopeSegment {
                    slope: segment_slope,
                    distance: segment_dist,
                };
            }
        }

        for_each_window!(
            trkseg,
            trkseg.first_index(),
            trkseg.last_index(),
            0.05,
            |i, j| {
                let i = trkseg.to_flat_index(i);
                let j = trkseg.to_flat_index(j);
                self.local[j].total_distance - self.local[i].total_distance
            },
            |i, left, right| {
                let flat_i = trkseg.to_flat_index(i);
                let flat_left = trkseg.to_flat_index(left);
                let flat_right = trkseg.to_flat_index(right);
                let dist =
                    self.local[flat_right].total_distance - self.local[flat_left].total_distance;
                let ele = trkseg[right].ele - trkseg[left].ele;
                self.local[flat_i].slope = slope(ele, dist);
            },
        );
    }
}

#[derive(Default, Debug)]
pub struct GlobalStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub moving_time: Option<i64>,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub bounds: LngLatBounds,
}

fn sum_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: Add<Output = T>,
{
    match (a, b) {
        (Some(a), Some(b)) => Some(a + b),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

impl GlobalStatistics {
    pub fn merge(&mut self, other: &GlobalStatistics) {
        self.total_distance += other.total_distance;
        self.moving_distance = sum_options(self.moving_distance, other.moving_distance);
        self.moving_time = sum_options(self.moving_time, other.moving_time);
        self.elevation_gain += other.elevation_gain;
        self.elevation_loss += other.elevation_loss;
        self.bounds.merge(&other.bounds);
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
    fn from_partial_stats(stats: &GPXStatistics) -> Self {
        Self {
            total_distance: stats.global.total_distance,
            moving_distance: stats.global.moving_distance,
            total_time: stats.total_time(),
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

    use crate::io::parse;

    use super::*;

    #[test]
    fn test_compute_smoothed_speed() {
        let mut f = File::open("data/with_time.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        let gpx = parse(data.as_bytes()).unwrap();

        let trkseg = &gpx.trk[0].trkseg[0];
        let stats = GPXStatistics::compute(trkseg);
        assert_eq!(stats.local.len(), trkseg.len());
        for trkpt_stats in stats.local.iter() {
            assert!(trkpt_stats.speed.is_some());
            let speed = trkpt_stats.speed.unwrap();
            assert_ne!(speed, f64::NAN);
            assert!((speed - 20.0).abs() < 0.1);
        }
    }
}
