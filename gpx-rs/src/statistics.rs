use crate::{
    algorithms::ramer_douglas_peucker,
    for_each_window,
    gpx::{LngLat, LngLatBounds, TrackPoint, TrackPointChunk},
    utils::{distance, slope, speed},
};

#[derive(Default, Debug)]
pub struct GPXStatistics {
    pub total_distance: f64,
    pub moving_distance: Option<f64>,
    pub moving_time: Option<i64>,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub bounds: LngLatBounds,
    pub local: Vec<TrackpointStatistics>,
}

impl GPXStatistics {
    pub fn total_time(&self) -> Option<i64> {
        self.start_time.zip(self.end_time).map(|(t1, t2)| t2 - t1)
    }

    pub fn total_speed(&self) -> Option<f64> {
        self.total_time().map(|t| speed(self.total_distance, t))
    }

    pub fn moving_speed(&self) -> Option<f64> {
        self.moving_distance
            .zip(self.moving_time)
            .map(|(d, t)| speed(d, t))
    }

    pub fn compute(chunk: &TrackPointChunk) -> Self {
        let mut stats = Self::default();
        if chunk.trkpt.is_empty() {
            return stats;
        }

        let mut prev = &chunk.trkpt[0];
        for i in 0..chunk.trkpt.len() {
            let cur = &chunk.trkpt[i];
            stats.accumulate(prev, cur);
            prev = cur;
        }

        stats.compute_smoothed_speed(chunk);
        stats.compute_smoothed_elevation_gain(chunk);

        stats
    }

    fn accumulate(&mut self, prev: &TrackPoint, cur: &TrackPoint) {
        self.accumulate_distance_and_time(prev, cur);
        self.update_time_bounds(cur.time);
        self.update_bounds(&cur.coordinates);
        self.local
            .push(TrackpointStatistics::from_partial_stats(&self));
    }

    fn accumulate_distance_and_time(&mut self, prev: &TrackPoint, cur: &TrackPoint) {
        let dist = distance(prev.coordinates, cur.coordinates);
        let time = prev.time.zip(cur.time).map(|(t1, t2)| t2 - t1);

        self.total_distance += dist;

        if let Some(time) = time {
            let speed = speed(dist, time);
            if speed >= 0.5 && speed <= 1500.0 {
                self.moving_distance = self.moving_distance.map_or(Some(dist), |d| Some(d + dist));
                self.moving_time = self.moving_time.map_or(Some(time), |t| Some(t + time));
            }
        }
    }

    fn update_time_bounds(&mut self, time: Option<i64>) {
        if let Some(time) = time {
            if self.start_time.is_none() {
                self.start_time = Some(time);
            }
            self.end_time = Some(time);
        }
    }

    fn update_bounds(&mut self, coordinates: &LngLat) {
        self.bounds.sw.lng = self.bounds.sw.lng.min(coordinates.lng);
        self.bounds.sw.lat = self.bounds.sw.lat.min(coordinates.lat);
        self.bounds.ne.lng = self.bounds.ne.lng.min(coordinates.lng);
        self.bounds.ne.lat = self.bounds.ne.lat.min(coordinates.lat);
    }

    fn compute_smoothed_speed(&mut self, chunk: &TrackPointChunk) {
        for_each_window!(
            0,
            chunk.trkpt.len(),
            Some(10000),
            |i, j| {
                chunk.trkpt[i]
                    .time
                    .zip(chunk.trkpt[j].time)
                    .map(|(t1, t2)| t2 - t1)
            },
            |i, left, right| {
                self.local[i].speed =
                    chunk.trkpt[left]
                        .time
                        .zip(chunk.trkpt[right].time)
                        .map(|(t1, t2)| {
                            speed(
                                self.local[right].total_distance - self.local[left].total_distance,
                                t2 - t1,
                            )
                        });
            },
        );
    }

    fn compute_smoothed_elevation_gain(&mut self, chunk: &TrackPointChunk) {
        let simplified = ramer_douglas_peucker(
            chunk.trkpt.len(),
            &|i, j, k| {
                let x1 = self.local[i].total_distance * 1000.0;
                let x2 = self.local[j].total_distance * 1000.0;
                let x3 = self.local[k].total_distance * 1000.0;
                let y1 = chunk.trkpt[i].ele;
                let y2 = chunk.trkpt[j].ele;
                let y3 = chunk.trkpt[k].ele;

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
            let mut current_right = start;
            let mut prev_smoothed_ele = chunk.trkpt[start].ele;

            for_each_window!(
                start,
                end,
                0.1,
                |i, j| self.local[j].total_distance - self.local[i].total_distance,
                |i, left, right| {
                    for i in current_left..left {
                        cumul_ele -= chunk.trkpt[i].ele;
                    }
                    for i in current_right..=right {
                        cumul_ele += chunk.trkpt[i].ele;
                    }
                    current_left = left;
                    current_right = right + 1;

                    let smoothed_ele: f64 = if i == start || i == end {
                        chunk.trkpt[i].ele
                    } else {
                        cumul_ele / (right - left + 1) as f64
                    };

                    let delta = smoothed_ele - prev_smoothed_ele;
                    if delta > 0.0 {
                        self.elevation_gain += delta;
                    } else if delta < 0.0 {
                        self.elevation_loss -= delta;
                    }

                    if i < end || last {
                        self.local[i].elevation_gain = self.elevation_gain;
                        self.local[i].elevation_loss = self.elevation_loss;
                    }

                    prev_smoothed_ele = smoothed_ele;
                },
            );

            let segment_dist = self.local[end].total_distance - self.local[start].total_distance;
            let segment_ele = chunk.trkpt[end].ele - chunk.trkpt[start].ele;
            let segment_slope = slope(segment_ele, segment_dist);
            for k in start..(end + last as usize) {
                self.local[k].slope_segment = SlopeSegment {
                    slope: segment_slope,
                    distance: segment_dist,
                };
            }
        }

        for_each_window!(
            0,
            chunk.trkpt.len(),
            0.05,
            |i, j| self.local[j].total_distance - self.local[i].total_distance,
            |i, left, right| {
                let dist = self.local[right].total_distance - self.local[left].total_distance;
                let ele = chunk.trkpt[right].ele - chunk.trkpt[left].ele;
                self.local[i].slope = slope(ele, dist);
            },
        );
    }
}

#[derive(Default, Debug)]
pub struct SlopeSegment {
    pub slope: f64,
    pub distance: f64,
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
            total_distance: stats.total_distance,
            moving_distance: stats.moving_distance,
            total_time: stats.start_time.zip(stats.end_time).map(|(t1, t2)| t2 - t1),
            moving_time: stats.moving_time,
            speed: None,
            elevation_gain: stats.elevation_gain,
            elevation_loss: stats.elevation_loss,
            slope: Default::default(),
            slope_segment: Default::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Read};

    use crate::actions::parse;

    use super::*;

    #[test]
    fn test_parse_simple() {
        let mut f = File::open("data/with_time.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);
        let gpx = parse(data.as_bytes()).unwrap();

        println!(
            "{:?}",
            GPXStatistics::compute(&gpx.trk[0].trkseg[0].chunks[0])
        );
    }
}
