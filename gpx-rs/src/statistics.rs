use crate::{
    gpx::{LngLat, LngLatBounds, TrackPoint, TrackPointChunk},
    utils::{distance, speed},
};

#[derive(Default)]
pub struct GPXStatistics {
    pub total_distance: f64,
    pub moving_distance: f64,
    pub moving_time: i64,
    pub elevation_gain: f64,
    pub elevation_loss: f64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub bounds: LngLatBounds,
    pub local: Vec<TrackpointStatistics>,
}

impl GPXStatistics {
    fn accumulate(&mut self, prev: &TrackPoint, cur: &TrackPoint) {
        self.accumulate_distance_and_time(prev, cur);
        self.update_time_bounds(cur.time);
        self.update_bounds(&cur.coordinates);
        self.local
            .push(TrackpointStatistics::from_partial_stats(&self));
    }

    fn accumulate_distance_and_time(&mut self, prev: &TrackPoint, cur: &TrackPoint) {
        let dist = distance(&prev.coordinates, &cur.coordinates);
        let time = prev.time.zip(cur.time).map(|(t1, t2)| t2 - t1);

        self.total_distance += dist;

        if let Some(time) = time {
            let speed = speed(dist, time);
            if speed >= 0.5 && speed <= 1500.0 {
                self.moving_distance += dist;
                self.moving_time += time;
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
}

#[derive(Default)]
pub struct SlopeSegment {
    pub slope: f64,
    pub distance: f64,
}

#[derive(Default)]
pub struct TrackpointStatistics {
    pub total_distance: f64,
    pub moving_distance: f64,
    pub total_time: i64,
    pub moving_time: i64,
    pub speed: f64,
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
            total_time: stats
                .start_time
                .zip(stats.end_time)
                .map_or(0, |(t1, t2)| t2 - t1),
            moving_time: stats.moving_time,
            speed: todo!(),
            elevation_gain: stats.elevation_gain,
            elevation_loss: stats.elevation_loss,
            slope: Default::default(),
            slope_segment: Default::default(),
        }
    }
}

impl GPXStatistics {
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
        stats
    }
}
