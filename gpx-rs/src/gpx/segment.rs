use std::rc::Rc;

use crate::gpx::TrackPoint;

#[derive(Debug, Default)]
pub struct TrackSegment {
    pub chunks: Vec<Rc<TrackPointChunk>>,
}

static MAX_CHUNK_SIZE: usize = 4096;

#[derive(Debug, Default)]
pub struct TrackPointChunk {
    pub trkpt: Vec<TrackPoint>,
}

impl TrackPointChunk {
    pub fn is_full(&self) -> bool {
        self.trkpt.len() == MAX_CHUNK_SIZE
    }
}
