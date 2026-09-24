use crate::statistics::{GPXStatistics, GlobalStatistics};

pub struct Buffer {
    pub total_distance: Vec<f64>,
    pub total_time: Vec<i64>,
    pub moving_time: Vec<i64>,
    pub speed: Vec<f64>,
    pub elevation_gain: Vec<f64>,
    pub elevation_loss: Vec<f64>,
    pub slope: Vec<f64>,
    pub slope_segment_slope: Vec<f64>,
    pub slope_segment_distance: Vec<f64>,
}

impl Buffer {
    pub fn update(&mut self, stats: &[&GPXStatistics]) {
        self.total_distance.clear();
        self.total_time.clear();
        self.moving_time.clear();
        self.speed.clear();
        self.elevation_gain.clear();
        self.elevation_loss.clear();
        self.slope.clear();
        self.slope_segment_slope.clear();
        self.slope_segment_distance.clear();

        let mut cumul_stats = GlobalStatistics::default();
        for stats in stats {
            // add stats
            // merge global ones into cumul
            cumul_stats.merge(&stats.global);
        }
    }
}
