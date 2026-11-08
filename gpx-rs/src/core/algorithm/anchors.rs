use std::f64::consts::PI;

use crate::{
    TrackSegment, TrackSegmentIndex, core::utils::crossarc_lnglat, ramer_douglas_peucker_by,
};

/// Highest zoom level of the map at which an anchor can appear.
pub const MAX_ANCHOR_ZOOM: u8 = 22;

/// Details smaller than this (in meters) do not get an anchor.
const ANCHOR_EPSILON: f64 = 1.0;

const EARTH_RADIUS_METERS: f64 = 6371008.8;

/// Lowest map zoom level at which an anchor selected at `distance` meters from the line of its
/// neighbours is worth showing: the smaller the detail, the higher the zoom. The ends of a
/// segment (no distance) are always shown.
pub fn anchor_zoom(lat: f64, distance: Option<f64>) -> u8 {
    let Some(distance) = distance else {
        return 0;
    };
    let width = EARTH_RADIUS_METERS * (lat * PI / 180.0).cos() / distance;
    width.log2().round().clamp(0.0, MAX_ANCHOR_ZOOM as f64) as u8
}

/// The anchors of a segment, as `(index, zoom)` sorted by index: the trackpoints kept by the
/// Ramer-Douglas-Peucker simplification of its path, the ones for smaller details being shown at
/// higher zoom levels only.
pub fn compute_anchors(trkseg: &TrackSegment) -> Vec<(usize, u8)> {
    let measure = |start: TrackSegmentIndex, end: TrackSegmentIndex, idx: TrackSegmentIndex| {
        crossarc_lnglat(
            trkseg[start].coordinates,
            trkseg[end].coordinates,
            trkseg[idx].coordinates,
        )
    };
    ramer_douglas_peucker_by(trkseg, &measure, ANCHOR_EPSILON)
        .into_iter()
        .map(|(idx, distance)| (idx.flat, anchor_zoom(trkseg[idx].coordinates.lat, distance)))
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::{LngLat, Trackpoint, TrackpointChunk};

    use super::*;

    fn segment(points: &[(f64, f64)]) -> TrackSegment {
        let mut trkseg = TrackSegment::default();
        let mut chunk = TrackpointChunk::default();
        for (lng, lat) in points {
            chunk.trkpt.push(Trackpoint {
                coordinates: LngLat {
                    lng: *lng,
                    lat: *lat,
                },
                ..Default::default()
            });
        }
        trkseg.push(chunk);
        trkseg
    }

    #[test]
    fn test_zoom_depends_on_the_size_of_the_detail() {
        assert_eq!(anchor_zoom(45.0, None), 0);
        // 2^13 meters is close to the radius of the earth divided by 1 km
        assert_eq!(anchor_zoom(0.0, Some(1_000.0)), 13);
        assert!(anchor_zoom(0.0, Some(10.0)) > anchor_zoom(0.0, Some(1_000.0)));
        assert_eq!(anchor_zoom(0.0, Some(1e-9)), MAX_ANCHOR_ZOOM);
        assert_eq!(anchor_zoom(0.0, Some(1e9)), 0);
        // the poles do not give NaN or a panic
        assert_eq!(anchor_zoom(90.0, Some(10.0)), 0);
    }

    #[test]
    fn test_anchors_of_a_straight_line_are_its_ends() {
        let line: Vec<_> = (0..10).map(|i| (i as f64 * 0.001, 0.0)).collect();
        assert_eq!(compute_anchors(&segment(&line)), vec![(0, 0), (9, 0)]);
    }

    #[test]
    fn test_anchors_keep_the_corners() {
        // a big corner and a small bump
        let points = [
            (0.0, 0.0),
            (0.01, 0.0),
            (0.02, 0.0),
            (0.02, 0.01),
            (0.02, 0.02),
            (0.02, 0.020005),
            (0.02, 0.03),
        ];
        let anchors = compute_anchors(&segment(&points));
        let indices: Vec<_> = anchors.iter().map(|(i, _)| *i).collect();
        assert_eq!(indices, vec![0, 2, 6]);
        assert_eq!(anchors[0].1, 0);
        assert_eq!(anchors[2].1, 0);
        assert!(anchors[1].1 > 0);
    }

    #[test]
    fn test_anchors_of_short_segments() {
        assert!(compute_anchors(&segment(&[])).is_empty());
        assert_eq!(compute_anchors(&segment(&[(1.0, 2.0)])), vec![(0, 0)]);
        assert_eq!(
            compute_anchors(&segment(&[(1.0, 2.0), (1.0, 2.1)])),
            vec![(0, 0), (1, 0)]
        );
    }
}
