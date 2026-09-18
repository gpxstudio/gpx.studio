use std::{cell::RefCell, rc::Rc};

use crate::gpx::TrackPoint;

#[derive(Debug, Default)]
pub struct TrackSegment {
    pub chunks: Vec<Rc<RefCell<TrackPointChunk>>>,
}

impl TrackSegment {
    pub fn append(&mut self, trkpt: TrackPoint) {
        if self
            .chunks
            .last()
            .is_none_or(|c| c.borrow().trkpt.len() == MAX_CHUNK_SIZE)
        {
            self.add_chunk();
        }

        self.chunks
            .last_mut()
            .unwrap()
            .borrow_mut()
            .trkpt
            .push(trkpt);
    }

    fn add_chunk(&mut self) {
        self.chunks
            .push(Rc::new(RefCell::new(TrackPointChunk::default())));
    }
}

static MAX_CHUNK_SIZE: usize = 4096;

#[derive(Debug, Default)]
pub struct TrackPointChunk {
    pub trkpt: Vec<TrackPoint>,
}
