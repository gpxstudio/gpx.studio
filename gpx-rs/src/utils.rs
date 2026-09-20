use std::f64::consts::PI;

use crate::gpx::LngLat;

static TO_RADIANS: f64 = PI / 180.0;
static EARTH_RADIUS: f64 = 6371.0088;

/// Computes the distance in kilometers between two coordinates using the Haversine formula
pub fn distance(coord1: &LngLat, coord2: &LngLat) -> f64 {
    let lat1 = coord1.lat * TO_RADIANS;
    let lat2 = coord2.lat * TO_RADIANS;
    let delta_lat = lat2 - lat1;
    let delta_lng = (coord2.lng - coord1.lng) * TO_RADIANS;

    let a =
        (delta_lat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (delta_lng / 2.0).sin().powi(2);
    let c = 2.0 * a.min(1.0).sqrt().asin();
    EARTH_RADIUS * c
}

/// Computes the speed for a given distance in kilometers and a time in milliseconds
pub fn speed(distance: f64, time: i64) -> f64 {
    distance / (time as f64 / 3600_000.0)
}
