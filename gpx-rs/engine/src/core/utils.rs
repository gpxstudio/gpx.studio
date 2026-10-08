use std::f64::consts::PI;

use crate::LngLat;

const TO_RADIANS: f64 = PI / 180.0;
const EARTH_RADIUS: f64 = 6371.0088;

/// Computes the distance in kilometers between two coordinates using the Haversine formula
pub fn distance(p1: LngLat, p2: LngLat) -> f64 {
    let lat1 = p1.lat * TO_RADIANS;
    let lat2 = p2.lat * TO_RADIANS;
    let delta_lat = lat2 - lat1;
    let delta_lng = (p2.lng - p1.lng) * TO_RADIANS;

    let a =
        (delta_lat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (delta_lng / 2.0).sin().powi(2);
    let c = 2.0 * a.min(1.0).sqrt().asin();
    EARTH_RADIUS * c
}

pub fn time_diff(a: Option<i64>, b: Option<i64>) -> Option<i64> {
    Some(a? - b?)
}

/// Computes the speed in km/h for a given distance in kilometers and a time in milliseconds.
/// Unknown if the time is not a positive duration.
pub fn speed(distance: f64, time: i64) -> Option<f64> {
    (time > 0).then(|| distance / (time as f64 / 3_600_000.0))
}

pub fn slope(ele: f64, distance: f64) -> f64 {
    if distance == 0.0 {
        100.0
    } else {
        0.1 * ele / distance
    }
}

const METERS_PER_LATITUDE_DEGREE: f64 = 111320.0;

/// Approximate planar projection, in meters, around the latitude of `origin` (ignores the
/// curvature of the earth).
struct Planar {
    meters_per_longitude_degree: f64,
}

impl Planar {
    fn around(origin: LngLat) -> Self {
        Self {
            meters_per_longitude_degree: (origin.lat * TO_RADIANS).cos()
                * METERS_PER_LATITUDE_DEGREE,
        }
    }

    fn to_meters(&self, p: LngLat) -> (f64, f64) {
        (
            p.lng * self.meters_per_longitude_degree,
            p.lat * METERS_PER_LATITUDE_DEGREE,
        )
    }

    fn to_degrees(&self, (x, y): (f64, f64)) -> LngLat {
        LngLat {
            lng: x / self.meters_per_longitude_degree,
            lat: y / METERS_PER_LATITUDE_DEGREE,
        }
    }
}

/// Position, between 0 (at `(x1, y1)`) and 1 (at `(x2, y2)`), of the point of the segment that is
/// the closest to `(x3, y3)`. A degenerate segment (same ends) is a point.
fn closest_on_segment(x1: f64, y1: f64, x2: f64, y2: f64, x3: f64, y3: f64) -> f64 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let segment_length_squared = dx * dx + dy * dy;
    if segment_length_squared == 0.0 {
        0.0
    } else {
        (((x3 - x1) * dx + (y3 - y1) * dy) / segment_length_squared).clamp(0.0, 1.0)
    }
}

/// Calculates the point on the line segment defined by p1 and p2 that is closest to the third
/// point, p3. Uses simple planar geometry (ignores earth curvature).
pub fn projected(p1: LngLat, p2: LngLat, p3: LngLat) -> LngLat {
    let planar = Planar::around(p1);
    let (x1, y1) = planar.to_meters(p1);
    let (x2, y2) = planar.to_meters(p2);
    let (x3, y3) = planar.to_meters(p3);
    let t = closest_on_segment(x1, y1, x2, y2, x3, y3);
    planar.to_degrees((x1 + t * (x2 - x1), y1 + t * (y2 - y1)))
}

/// Calculates the perpendicular distance in meters between a line segment (defined by p1 and p2)
/// and a third point, p3. Uses simple planar geometry (ignores earth curvature).
pub fn crossarc_lnglat(p1: LngLat, p2: LngLat, p3: LngLat) -> f64 {
    let planar = Planar::around(p1);
    let (x1, y1) = planar.to_meters(p1);
    let (x2, y2) = planar.to_meters(p2);
    let (x3, y3) = planar.to_meters(p3);
    crossarc(x1, y1, x2, y2, x3, y3)
}

/// Distance from the point `(x3, y3)` to the segment `(x1, y1)`-`(x2, y2)`, in the units of the
/// coordinates (planar geometry).
pub fn crossarc(x1: f64, y1: f64, x2: f64, y2: f64, x3: f64, y3: f64) -> f64 {
    let t = closest_on_segment(x1, y1, x2, y2, x3, y3);
    (x3 - (x1 + t * (x2 - x1))).hypot(y3 - (y1 + t * (y2 - y1)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(lng: f64, lat: f64) -> LngLat {
        LngLat { lng, lat }
    }

    #[test]
    fn test_time_diff_and_speed_with_long_durations() {
        // 40 days in milliseconds, more than an i32 can hold
        let forty_days = 40 * 24 * 3_600_000_i64;
        assert!(forty_days > i64::from(i32::MAX));
        assert_eq!(time_diff(Some(forty_days), Some(0)), Some(forty_days));
        assert_eq!(time_diff(Some(0), Some(forty_days)), Some(-forty_days));
        assert_eq!(time_diff(None, Some(1)), None);
        assert_eq!(time_diff(Some(1), None), None);
        // 1 km in one hour
        assert!((speed(1.0, 3_600_000).unwrap() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn test_distance() {
        assert_eq!(distance(p(4.0, 50.0), p(4.0, 50.0)), 0.0);
        // one degree of latitude
        let d = distance(p(0.0, 0.0), p(0.0, 1.0));
        assert!((d - 111.195).abs() < 0.01, "{d}");
        // symmetric
        let a = p(4.40, 50.79);
        let b = p(6.13, 45.90);
        assert!((distance(a, b) - distance(b, a)).abs() < 1e-9);
        // half the Earth's circumference, without NaN from rounding
        let antipodal = distance(p(0.0, 0.0), p(180.0, 0.0));
        assert!((antipodal - PI * EARTH_RADIUS).abs() < 1e-6);
    }

    #[test]
    fn test_time_diff() {
        assert_eq!(time_diff(Some(5000), Some(2000)), Some(3000));
        assert_eq!(time_diff(Some(2000), Some(5000)), Some(-3000));
        assert_eq!(time_diff(None, Some(1)), None);
        assert_eq!(time_diff(Some(1), None), None);
    }

    #[test]
    fn test_speed() {
        // 1 km in 1 h
        assert!((speed(1.0, 3_600_000).unwrap() - 1.0).abs() < 1e-12);
        // 10 km in 30 min
        assert!((speed(10.0, 1_800_000).unwrap() - 20.0).abs() < 1e-12);
        // no duration, no speed
        assert_eq!(speed(1.0, 0), None);
        assert_eq!(speed(0.0, 0), None);
        assert_eq!(speed(1.0, -1000), None);
    }

    #[test]
    fn test_slope() {
        // 10 m of elevation over 100 m (distance is expressed in km, hence the 0.1 factor)
        assert!((slope(10.0, 0.1) - 10.0).abs() < 1e-12);
        assert!((slope(-5.0, 0.1) + 5.0).abs() < 1e-12);
        assert_eq!(slope(0.0, 1.0), 0.0);
        assert_eq!(slope(10.0, 0.0), 100.0);
    }

    #[test]
    fn test_crossarc() {
        // perpendicular distance to the segment (0,0)-(10,0)
        assert!((crossarc(0.0, 0.0, 10.0, 0.0, 5.0, 3.0) - 3.0).abs() < 1e-12);
        // beyond the ends: distance to the closest endpoint
        assert!((crossarc(0.0, 0.0, 10.0, 0.0, 13.0, 4.0) - 5.0).abs() < 1e-12);
        assert!((crossarc(0.0, 0.0, 10.0, 0.0, -3.0, 4.0) - 5.0).abs() < 1e-12);
        // point on the segment
        assert_eq!(crossarc(0.0, 0.0, 10.0, 0.0, 4.0, 0.0), 0.0);
        // degenerate segment
        assert!((crossarc(1.0, 1.0, 1.0, 1.0, 4.0, 5.0) - 5.0).abs() < 1e-12);
    }

    #[test]
    fn test_projected() {
        let proj = projected(p(0.0, 0.0), p(1.0, 0.0), p(0.5, 1.0));
        assert!((proj.lng - 0.5).abs() < 1e-9);
        assert!(proj.lat.abs() < 1e-9);
        // clamped to the segment
        let proj = projected(p(0.0, 0.0), p(1.0, 0.0), p(2.0, 1.0));
        assert!((proj.lng - 1.0).abs() < 1e-9);
        // degenerate segment
        let proj = projected(p(3.0, 4.0), p(3.0, 4.0), p(5.0, 6.0));
        assert_eq!((proj.lng, proj.lat), (3.0, 4.0));
    }

    #[test]
    fn test_crossarc_lnglat() {
        // about 1 degree of latitude away from an east-west segment on the equator
        let d = crossarc_lnglat(p(0.0, 0.0), p(1.0, 0.0), p(0.5, 1.0));
        assert!((d - METERS_PER_LATITUDE_DEGREE).abs() < 1e-6);
    }
}
