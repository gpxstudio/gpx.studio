use crate::{
    File, FileId, FileWaypointsRevisionId, TrackId, TrackSegmentId, TrackSegmentRevisionId,
    WaypointId,
};

/// What the UI needs to display a file: its name and the structure of its tracks and waypoints,
/// with the ids that reference every element. Coordinates are not part of it, they are read
/// from the buffers of the [`CoordinatesCache`](crate::CoordinatesCache) (the `i`-th waypoint
/// of a file is the `i`-th coordinates pair of its waypoint buffer, same for the trackpoints of
/// a segment).
#[derive(Debug, Clone, PartialEq)]
pub struct FileStructure {
    pub id: FileId,
    pub name: String,
    pub tracks: Vec<TrackNode>,
    pub waypoints: Vec<WaypointNode>,
    /// Changes whenever the waypoints of the file (hence their buffer) change.
    pub wpt_rev_id: FileWaypointsRevisionId,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrackNode {
    pub id: TrackId,
    pub name: Option<String>,
    /// Style of the track, only when the file defines it.
    pub color: Option<String>,
    pub opacity: Option<f64>,
    pub width: Option<f64>,
    pub segments: Vec<SegmentNode>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SegmentNode {
    pub id: TrackSegmentId,
    /// Changes whenever the trackpoints of the segment (hence their buffer) change.
    pub rev_id: TrackSegmentRevisionId,
    pub len: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WaypointNode {
    pub id: WaypointId,
    pub name: Option<String>,
    pub sym: Option<String>,
}

impl FileStructure {
    pub fn new(file: &File) -> Self {
        Self {
            id: file.id,
            name: file.info.name.clone(),
            tracks: file
                .trk
                .iter()
                .map(|trk| TrackNode {
                    id: trk.id,
                    name: trk.info.name.clone(),
                    color: trk.info.color.clone(),
                    opacity: trk.info.opacity,
                    width: trk.info.width,
                    segments: trk
                        .trkseg
                        .iter()
                        .map(|seg| SegmentNode {
                            id: seg.id,
                            rev_id: seg.rev_id,
                            len: seg.len(),
                        })
                        .collect(),
                })
                .collect(),
            waypoints: file
                .wpt
                .iter()
                .flat_map(|chunk| &chunk.wpt)
                .map(|wpt| WaypointNode {
                    id: wpt.id,
                    name: wpt.name.clone(),
                    sym: wpt.sym.clone(),
                })
                .collect(),
            wpt_rev_id: file.wpt_rev_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{Apply, Load, Waypoint, WaypointChunk, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_structure_of_a_file() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let file = &fx.files[&fx.order.0[0]];
        let node = FileStructure::new(file);
        assert_eq!((node.id, &node.name), (file.id, &file.info.name));
        assert_eq!(node.tracks.len(), file.trk.len());
        for (n, t) in node.tracks.iter().zip(&file.trk) {
            assert_eq!((n.id, &n.name), (t.id, &t.info.name));
            assert_eq!(
                (&n.color, n.opacity, n.width),
                (&t.info.color, t.info.opacity, t.info.width)
            );
            assert_eq!(n.segments.len(), t.trkseg.len());
            for (n, s) in n.segments.iter().zip(&t.trkseg) {
                assert_eq!((n.id, n.rev_id, n.len), (s.id, s.rev_id, s.len()));
            }
        }
    }

    #[test]
    fn test_waypoints_in_buffer_order_and_revision() {
        let mut file = crate::File::default();
        let wpt = |n: &str| Waypoint {
            name: Some(n.to_string()),
            ..Default::default()
        };
        let before = file.wpt_rev_id;
        file.wpt_rev_id = Default::default();
        file.wpt = vec![
            Rc::new(WaypointChunk {
                wpt: vec![wpt("a"), wpt("b")],
                ..Default::default()
            }),
            Rc::new(WaypointChunk {
                wpt: vec![wpt("c")],
                ..Default::default()
            }),
        ];
        let node = FileStructure::new(&file);
        let names: Vec<_> = node
            .waypoints
            .iter()
            .map(|w| w.name.clone().unwrap())
            .collect();
        assert_eq!(names, ["a", "b", "c"]);
        assert_ne!(node.wpt_rev_id, before);
        assert_eq!(node.wpt_rev_id, file.wpt_rev_id);
    }
}
