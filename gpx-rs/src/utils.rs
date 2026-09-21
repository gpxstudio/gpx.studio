use std::f64::consts::PI;

use crate::gpx::LngLat;

static TO_RADIANS: f64 = PI / 180.0;
static EARTH_RADIUS: f64 = 6371.0088;

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

/// Computes the speed for a given distance in kilometers and a time in milliseconds
pub fn speed(distance: f64, time: i64) -> f64 {
    distance / (time as f64 / 3600_000.0)
}

pub fn slope(ele: f64, distance: f64) -> f64 {
    if distance == 0.0 {
        100.0
    } else {
        0.1 * ele / distance
    }
}

static METERS_PER_LATITUDE_DEGREE: f64 = 111320.0;

fn get_meters_per_longitude_degree(latitude: f64) -> f64 {
    ((latitude * PI) / 180.0).cos() * METERS_PER_LATITUDE_DEGREE
}

// Calculates the point on the line segment defined by p1 and p2
// that is closest to the third point, p3.
// Uses simple planar geometry (ignores earth curvature).
fn projected(p1: LngLat, p2: LngLat, coord3: LngLat) -> LngLat {
    // Convert to meters using approximate scaling
    let meters_per_longitude_degree = get_meters_per_longitude_degree(p1.lat);

    let x1 = p1.lng * meters_per_longitude_degree;
    let y1 = p1.lat * METERS_PER_LATITUDE_DEGREE;
    let x2 = p2.lng * meters_per_longitude_degree;
    let y2 = p2.lat * METERS_PER_LATITUDE_DEGREE;
    let x3 = coord3.lng * meters_per_longitude_degree;
    let y3 = coord3.lat * METERS_PER_LATITUDE_DEGREE;

    let dx = x2 - x1;
    let dy = y2 - y1;
    let segment_length_squared = dx * dx + dy * dy;

    if segment_length_squared == 0.0 {
        // p1 and p2 are the same point
        p1
    } else {
        // Project p3 onto the line defined by p1-p2
        let t =
            0.0_f64.max(1.0_f64.min(((x3 - x1) * dx + (y3 - y1) * dy) / segment_length_squared));

        // Find the closest point on the segment
        let proj_x = x1 + t * dx;
        let proj_y = y1 + t * dy;

        // Convert back to degrees
        LngLat {
            lng: proj_x / meters_per_longitude_degree,
            lat: proj_y / METERS_PER_LATITUDE_DEGREE,
        }
    }
}

/// Calculates the perpendicular distance in meters
/// between a line segment (defined by p1 and p2) and a third point, p3.
/// Uses simple planar geometry (ignores earth curvature).
fn crossarc(p1: LngLat, p2: LngLat, p3: LngLat) -> f64 {
    // Convert to meters using approximate scaling
    let meters_per_longitude_degree = get_meters_per_longitude_degree(p1.lat);

    let x1 = p1.lng * meters_per_longitude_degree;
    let y1 = p1.lat * METERS_PER_LATITUDE_DEGREE;
    let x2 = p2.lng * meters_per_longitude_degree;
    let y2 = p2.lat * METERS_PER_LATITUDE_DEGREE;
    let x3 = p3.lng * meters_per_longitude_degree;
    let y3 = p3.lat * METERS_PER_LATITUDE_DEGREE;

    let dx = x2 - x1;
    let dy = y2 - y1;
    let segment_length_squared = dx * dx + dy * dy;

    if segment_length_squared == 0.0 {
        // p1 and p2 are the same point
        ((x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1)).sqrt()
    } else {
        // Project p3 onto the line defined by p1 - p2
        let t =
            0.0_f64.max(1.0_f64.min(((x3 - x1) * dx + (y3 - y1) * dy) / segment_length_squared));

        // Find the closest point on the segment
        let proj_x = x1 + t * dx;
        let proj_y = y1 + t * dy;

        // Return distance from p3 to the projected point
        ((x3 - proj_x) * (x3 - proj_x) + (y3 - proj_y) * (y3 - proj_y)).sqrt()
    }
}
