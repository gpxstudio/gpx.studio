use std::collections::{HashMap, HashSet};

use crate::{
    FileId, FileWaypointsRevisionId, StackEntry as Files, TrackSegmentId, TrackSegmentRevisionId,
};

/// Coordinates buffers, as flat `[lng, lat, lng, lat, ...]` arrays so that they can be handed
/// to the UI without per-point calls: one per track segment (its trackpoints) and one per file
/// (its waypoints). A buffer is only rebuilt when the revision of its segment (or the waypoints
/// of its file) changes, so editing a segment does not touch the buffers of the others.
#[derive(Debug, Default)]
pub struct CoordinatesCache {
    segments: HashMap<TrackSegmentId, (TrackSegmentRevisionId, Vec<f64>)>,
    waypoints: HashMap<FileId, (FileWaypointsRevisionId, Vec<f64>)>,
}

impl CoordinatesCache {
    pub fn update(&mut self, files: Option<&Files>) {
        let mut segments = HashSet::new();
        let mut waypoints = HashSet::new();
        for file in files.into_iter().flat_map(|files| files.values()) {
            waypoints.insert(file.id);
            if self
                .waypoints
                .get(&file.id)
                .is_none_or(|(r, _)| *r != file.wpt_rev_id)
            {
                let coordinates = file
                    .wpt
                    .iter()
                    .flat_map(|chunk| &chunk.wpt)
                    .flat_map(|wpt| [wpt.coordinates.lng, wpt.coordinates.lat])
                    .collect();
                self.waypoints
                    .insert(file.id, (file.wpt_rev_id, coordinates));
            }
            for seg in file.trk.iter().flat_map(|trk| &trk.trkseg) {
                segments.insert(seg.id);
                if self
                    .segments
                    .get(&seg.id)
                    .is_none_or(|(r, _)| *r != seg.rev_id)
                {
                    let coordinates = seg
                        .iter()
                        .flat_map(|trkpt| [trkpt.coordinates.lng, trkpt.coordinates.lat])
                        .collect();
                    self.segments.insert(seg.id, (seg.rev_id, coordinates));
                }
            }
        }
        self.segments.retain(|id, _| segments.contains(id));
        self.waypoints.retain(|id, _| waypoints.contains(id));
    }

    /// Coordinates of the trackpoints of a segment, empty if it does not exist.
    pub fn segment(&self, id: &TrackSegmentId) -> &[f64] {
        self.segments.get(id).map_or(&[], |(_, c)| c)
    }

    /// Coordinates of the waypoints of a file, empty if it does not exist.
    pub fn waypoints(&self, id: &FileId) -> &[f64] {
        self.waypoints.get(id).map_or(&[], |(_, c)| c)
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{Apply, LngLat, Load, Waypoint, WaypointChunk, engine::command::fixture::Fixture};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let id = fx.order.0[0];
        (fx, id)
    }

    #[test]
    fn test_segment_buffers_match_trackpoints() {
        let (fx, id) = loaded();
        let mut cache = CoordinatesCache::default();
        cache.update(Some(&fx.files));
        for seg in fx.files[&id].trk.iter().flat_map(|t| &t.trkseg) {
            let buffer = cache.segment(&seg.id);
            assert_eq!(buffer.len(), seg.len() * 2);
            for (i, p) in seg.iter().enumerate() {
                assert_eq!(buffer[2 * i], p.coordinates.lng);
                assert_eq!(buffer[2 * i + 1], p.coordinates.lat);
            }
        }
        assert!(cache.segment(&TrackSegmentId::default()).is_empty());
    }

    #[test]
    fn test_only_changed_buffers_are_rebuilt_and_stale_ones_dropped() {
        let (mut fx, id) = loaded();
        let mut cache = CoordinatesCache::default();
        cache.update(Some(&fx.files));
        let ids: Vec<_> = fx.files[&id]
            .trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .map(|s| s.id)
            .collect();
        assert!(ids.len() >= 2);
        let ptr = |c: &CoordinatesCache, i: usize| c.segment(&ids[i]).as_ptr();
        let (p0, p1) = (ptr(&cache, 0), ptr(&cache, 1));

        let mut file = (*fx.files[&id]).clone();
        let seg = &mut file.trk[0].trkseg[0];
        seg.splice(0, 0, vec![Default::default()]);
        seg.rev_id = Default::default();
        let len = seg.len();
        fx.files.insert(id, Rc::new(file));
        cache.update(Some(&fx.files));
        assert_eq!(cache.segment(&ids[0]).len(), len * 2);
        assert_ne!(ptr(&cache, 0), p0);
        assert_eq!(ptr(&cache, 1), p1);

        cache.update(None);
        assert!(cache.segment(&ids[0]).is_empty());
        assert!(cache.waypoints(&id).is_empty());
    }

    #[test]
    fn test_waypoint_buffer() {
        let (mut fx, id) = loaded();
        let wpt = |lng, lat| Waypoint {
            coordinates: LngLat { lng, lat },
            ..Default::default()
        };
        let mut file = (*fx.files[&id]).clone();
        file.wpt_rev_id = Default::default();
        file.wpt = vec![
            Rc::new(WaypointChunk {
                wpt: vec![wpt(1.0, 2.0)],
                ..Default::default()
            }),
            Rc::new(WaypointChunk {
                wpt: vec![wpt(3.0, 4.0)],
                ..Default::default()
            }),
        ];
        fx.files.insert(id, Rc::new(file));
        let mut cache = CoordinatesCache::default();
        cache.update(Some(&fx.files));
        assert_eq!(cache.waypoints(&id), [1.0, 2.0, 3.0, 4.0]);
    }
}
