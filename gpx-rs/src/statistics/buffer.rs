use crate::statistics::{GPXStatistics, GlobalStatistics, sum_options};

#[derive(Debug, Default)]
pub struct StatisticsBuffer {
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
}

impl StatisticsBuffer {
    pub fn update(&mut self, stats: &[&GPXStatistics]) {
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

        let mut cumul_stats = GlobalStatistics::default();
        for stats in stats {
            for trkpt_stats in stats.local.iter() {
                self.total_distance
                    .push(cumul_stats.total_distance + trkpt_stats.total_distance);
                self.moving_distance.push(
                    sum_options(cumul_stats.moving_distance, trkpt_stats.moving_distance)
                        .unwrap_or_default(),
                );
                self.total_time.push(
                    sum_options(cumul_stats.total_time(), trkpt_stats.total_time)
                        .unwrap_or_default(),
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
            }
            cumul_stats.merge(&stats.global);
        }
    }
}
