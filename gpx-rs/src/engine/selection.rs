use std::collections::HashSet;

use crate::{FileId, TrackId, TrackSegmentId, WaypointId};

#[derive(Debug)]
pub struct FileSelection {
    pub files: HashSet<FileId>,
}

#[derive(Debug)]
pub struct TrackSelection {
    pub file: FileId,
    pub trk: HashSet<TrackId>,
}

#[derive(Debug)]
pub struct TrackSegmentSelection {
    pub file: FileId,
    pub trk: TrackId,
    pub trkseg: HashSet<TrackSegmentId>,
}

#[derive(Debug)]
pub struct WaypointsSelection {
    pub file: FileId,
}

#[derive(Debug)]
pub struct WaypointSelection {
    pub file: FileId,
    pub wpt: HashSet<WaypointId>,
}

#[derive(Debug, Default)]
pub enum Selection {
    #[default]
    Empty,
    File(FileSelection),
    Track(TrackSelection),
    TrackSegment(TrackSegmentSelection),
    Waypoints(WaypointsSelection),
    Waypoint(WaypointSelection),
}

impl Selection {
    pub fn select(&mut self, id: FileId) {
        let mut files = HashSet::default();
        files.insert(id);
        *self = Selection::File(FileSelection { files });
    }
}
