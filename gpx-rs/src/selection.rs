use std::collections::HashSet;

use uuid::Uuid;

#[derive(Debug)]
pub struct FileSelection {
    files: HashSet<Uuid>,
}

#[derive(Debug)]
pub struct TrackSelection {
    file: Uuid,
    trk: HashSet<Uuid>,
}

#[derive(Debug)]
pub struct TrackSegmentSelection {
    file: Uuid,
    trk: Uuid,
    trkseg: HashSet<Uuid>,
}

#[derive(Debug)]
pub struct WaypointSelection {
    file: Uuid,
    wpt: HashSet<Uuid>,
}

#[derive(Debug, Default)]
pub enum Selection {
    #[default]
    Empty,
    File(FileSelection),
    Track(TrackSelection),
    TrackSegment(TrackSegmentSelection),
    Waypoints,
    Waypoint(WaypointSelection),
}
