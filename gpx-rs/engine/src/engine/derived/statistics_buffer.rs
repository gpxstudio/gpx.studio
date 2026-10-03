use crate::{GlobalStatistics, Statistics, sum_options};

#[derive(Debug, Default)]
pub struct StatisticsBuffer {
    pub total_distance: Vec<f64>,
    pub moving_distance: Vec<f64>,
    pub total_time: Vec<i32>,
    pub moving_time: Vec<i32>,
    pub speed: Vec<f64>,
    pub elevation_gain: Vec<f64>,
    pub elevation_loss: Vec<f64>,
    pub slope: Vec<f64>,
    pub slope_segment_slope: Vec<f64>,
    pub slope_segment_distance: Vec<f64>,
}

impl StatisticsBuffer {
    pub fn update(&mut self, stats: &[&Statistics]) {
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
            }
            cumul_stats.merge(&stats.global);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::parse;

    use super::*;

    fn stats(path: &str) -> Statistics {
        let data = std::fs::read(path).unwrap();
        let file = parse(&data).unwrap();
        Statistics::compute(&file.trk[0].trkseg[0])
    }

    #[test]
    fn test_empty() {
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[]);
        assert!(buffer.total_distance.is_empty());
        assert!(buffer.speed.is_empty());
    }

    #[test]
    fn test_single_segment_matches_local_stats() {
        let s = stats("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[&s]);

        let n = s.local.len();
        for len in [
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
        ] {
            assert_eq!(len, n);
        }
        for (i, local) in s.local.iter().enumerate() {
            assert_eq!(buffer.total_distance[i], local.total_distance);
            assert_eq!(buffer.slope[i], local.slope);
        }
    }

    #[test]
    fn test_distances_accumulate_over_segments() {
        let s = stats("data/simple.gpx");
        let n = s.local.len();
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[&s, &s]);

        assert_eq!(buffer.total_distance.len(), 2 * n);
        // the second segment starts where the first one ended
        assert_eq!(buffer.total_distance[n], s.global.total_distance);
        assert!((buffer.total_distance[2 * n - 1] - 2.0 * s.global.total_distance).abs() < 1e-9);
        assert!(buffer.total_distance.windows(2).all(|w| w[0] <= w[1]));
        assert!((buffer.elevation_gain[2 * n - 1] - 2.0 * s.global.elevation_gain).abs() < 1e-9);
    }

    #[test]
    fn test_total_time_accumulates_over_segments() {
        let s = stats("data/with_time.gpx");
        let n = s.local.len();
        let duration = s.global.total_time.unwrap();
        assert!(duration > 0);
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[&s, &s]);

        assert_eq!(buffer.total_time[n - 1], duration);
        assert_eq!(buffer.total_time[n], duration);
        assert_eq!(buffer.total_time[2 * n - 1], 2 * duration);
        assert!(buffer.total_time.windows(2).all(|w| w[0] <= w[1]));
    }

    #[test]
    fn test_update_replaces_previous_content() {
        let s = stats("data/simple.gpx");
        let mut buffer = StatisticsBuffer::default();
        buffer.update(&[&s]);
        buffer.update(&[&s]);
        assert_eq!(buffer.total_distance.len(), s.local.len());
        buffer.update(&[]);
        assert!(buffer.total_distance.is_empty());
    }
}
