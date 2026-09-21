use std::rc::Rc;

use crate::gpx::TrackPoint;

#[derive(Debug, Default)]
pub struct TrackSegment {
    pub chunks: Vec<Rc<TrackPointChunk>>,
}

impl TrackSegment {
    pub fn iter(&self) -> TrackSegmentIterator {
        TrackSegmentIterator::new(self)
    }
}

pub struct TrackSegmentIterator<'a> {
    trkseg: &'a TrackSegment,
    chunk_idx: usize,
    trkpt_idx: usize,
}

impl<'a> TrackSegmentIterator<'a> {
    pub fn new(trkseg: &'a TrackSegment) -> Self {
        Self {
            trkseg,
            chunk_idx: 0,
            trkpt_idx: 0,
        }
    }
}

impl<'a> Iterator for TrackSegmentIterator<'a> {
    type Item = &'a TrackPoint;

    fn next(&mut self) -> Option<Self::Item> {
        if self.chunk_idx >= self.trkseg.chunks.len() {
            None
        } else if self.trkpt_idx >= self.trkseg.chunks[self.chunk_idx].trkpt.len() {
            self.chunk_idx += 1;
            self.trkpt_idx = 0;
            self.next()
        } else {
            self.trkpt_idx += 1;
            Some(&self.trkseg.chunks[self.chunk_idx].trkpt[self.trkpt_idx - 1])
        }
    }
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
