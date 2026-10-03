use uuid::Uuid;

use crate::{Trackpoint, Waypoint};

static MAX_TRKPT_CHUNK_SIZE: usize = 4096;

#[derive(Debug, PartialEq, Eq)]
pub struct TrackpointChunkId(Uuid);

impl Default for TrackpointChunkId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default)]
pub struct TrackpointChunk {
    pub id: TrackpointChunkId,
    pub trkpt: Vec<Trackpoint>,
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

#[derive(Debug, PartialEq, Eq)]
pub struct WaypointChunkId(Uuid);

impl Default for WaypointChunkId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

static MAX_WPT_CHUNK_SIZE: usize = 128;

#[derive(Debug, Default)]
pub struct WaypointChunk {
    pub id: WaypointChunkId,
    pub wpt: Vec<Waypoint>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trackpoint_chunk_full() {
        let mut chunk = TrackpointChunk::default();
        assert!(!chunk.is_full());
        for _ in 0..MAX_TRKPT_CHUNK_SIZE - 1 {
            chunk.trkpt.push(Trackpoint::default());
        }
        assert!(!chunk.is_full());
        chunk.trkpt.push(Trackpoint::default());
        assert!(chunk.is_full());
    }

    #[test]
    fn test_waypoint_chunk_full() {
        let mut chunk = WaypointChunk::default();
        assert!(!chunk.is_full());
        for _ in 0..MAX_WPT_CHUNK_SIZE {
            chunk.wpt.push(Waypoint::default());
        }
        assert!(chunk.is_full());
    }

    #[test]
    fn test_chunk_equality_is_by_id() {
        let a = TrackpointChunk::default();
        let b = TrackpointChunk::default();
        assert_ne!(a, b);
        let mut c = TrackpointChunk::default();
        c.id = TrackpointChunkId(a.id.0);
        c.trkpt.push(Trackpoint::default());
        assert_eq!(a, c);
    }
}
