use uuid::Uuid;

use crate::{Trackpoint, Waypoint};

/// A run of items, shared between the successive versions of a [`crate::Chunked`] list: a chunk
/// that is not touched by an edit is not copied.
///
/// Chunks are equal when they have the same identity, which is cheap to compare and changes
/// whenever the content does (a modified chunk is a new one).
pub trait Chunk {
    type Item: Clone;

    /// Maximum number of items of a chunk.
    const MAX_SIZE: usize;

    /// A chunk with a new identity, holding `items`.
    fn new(items: Vec<Self::Item>) -> Self;

    fn items(&self) -> &Vec<Self::Item>;

    fn items_mut(&mut self) -> &mut Vec<Self::Item>;

    fn is_full(&self) -> bool {
        self.items().len() >= Self::MAX_SIZE
    }
}

const MAX_TRKPT_CHUNK_SIZE: usize = 4096;

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

impl Chunk for TrackpointChunk {
    type Item = Trackpoint;
    const MAX_SIZE: usize = MAX_TRKPT_CHUNK_SIZE;

    fn new(trkpt: Vec<Trackpoint>) -> Self {
        Self {
            trkpt,
            ..Default::default()
        }
    }

    fn items(&self) -> &Vec<Trackpoint> {
        &self.trkpt
    }

    fn items_mut(&mut self) -> &mut Vec<Trackpoint> {
        &mut self.trkpt
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WaypointChunkId(Uuid);

impl Default for WaypointChunkId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

const MAX_WPT_CHUNK_SIZE: usize = 128;

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

impl Chunk for WaypointChunk {
    type Item = Waypoint;
    const MAX_SIZE: usize = MAX_WPT_CHUNK_SIZE;

    fn new(wpt: Vec<Waypoint>) -> Self {
        Self {
            wpt,
            ..Default::default()
        }
    }

    fn items(&self) -> &Vec<Waypoint> {
        &self.wpt
    }

    fn items_mut(&mut self) -> &mut Vec<Waypoint> {
        &mut self.wpt
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
    fn test_new_chunks_have_their_own_identity() {
        let a = TrackpointChunk::new(vec![Trackpoint::default()]);
        let b = TrackpointChunk::new(vec![Trackpoint::default()]);
        assert_ne!(a, b);
        assert_eq!(a.items().len(), 1);
        assert_ne!(WaypointChunk::new(vec![]), WaypointChunk::new(vec![]));
    }

    #[test]
    fn test_chunk_equality_is_by_id() {
        let a = TrackpointChunk::default();
        let b = TrackpointChunk::default();
        assert_ne!(a, b);
        let c = TrackpointChunk {
            id: TrackpointChunkId(a.id.0),
            trkpt: vec![Trackpoint::default()],
        };
        assert_eq!(a, c);
    }
}
