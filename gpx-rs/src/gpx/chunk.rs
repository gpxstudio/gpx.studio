use uuid::Uuid;

use crate::gpx::{Trackpoint, Waypoint};

static MAX_TRKPT_CHUNK_SIZE: usize = 4096;

#[derive(Debug)]
pub struct TrackpointChunk {
    pub id: Uuid,
    pub trkpt: Vec<Trackpoint>,
}

impl Default for TrackpointChunk {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            trkpt: Default::default(),
        }
    }
}

impl PartialEq for TrackpointChunk {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl TrackpointChunk {
    pub fn is_full(&self) -> bool {
        self.trkpt.len() == MAX_TRKPT_CHUNK_SIZE
    }
}

static MAX_WPT_CHUNK_SIZE: usize = 128;

#[derive(Debug)]
pub struct WaypointChunk {
    pub id: Uuid,
    pub wpt: Vec<Waypoint>,
}

impl Default for WaypointChunk {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            wpt: Default::default(),
        }
    }
}

impl PartialEq for WaypointChunk {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl WaypointChunk {
    pub fn is_full(&self) -> bool {
        self.wpt.len() == MAX_WPT_CHUNK_SIZE
    }
}
