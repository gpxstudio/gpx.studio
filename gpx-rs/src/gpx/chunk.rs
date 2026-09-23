use crate::gpx::{Trackpoint, Waypoint};

static MAX_TRKPT_CHUNK_SIZE: usize = 4096;

#[derive(Debug, Default)]
pub struct TrackpointChunk {
    pub trkpt: Vec<Trackpoint>,
}

impl TrackpointChunk {
    pub fn is_full(&self) -> bool {
        self.trkpt.len() == MAX_TRKPT_CHUNK_SIZE
    }
}

static MAX_WPT_CHUNK_SIZE: usize = 128;

#[derive(Debug, Default)]
pub struct WaypointChunk {
    pub wpt: Vec<Waypoint>,
}

impl WaypointChunk {
    pub fn is_full(&self) -> bool {
        self.wpt.len() == MAX_WPT_CHUNK_SIZE
    }
}
