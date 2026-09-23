use std::{ops::Index, rc::Rc};

use crate::gpx::{Trackpoint, TrackpointChunk};

#[derive(Debug, Default)]
pub struct TrackSegment {
    chunks: Vec<Rc<TrackpointChunk>>,
    cumul_length: Vec<usize>,
}

impl TrackSegment {
    pub fn push(&mut self, chunk: TrackpointChunk) {
        if chunk.trkpt.is_empty() {
            return;
        }
        self.cumul_length
            .push(self.cumul_length.last().copied().unwrap_or_default() + chunk.trkpt.len());
        self.chunks.push(Rc::new(chunk));
    }

    pub fn len(&self) -> usize {
        self.cumul_length.last().copied().unwrap_or_default()
    }

    pub fn iter(&self) -> TrackSegmentIterator<'_> {
        TrackSegmentIterator::new(self)
    }

    pub fn first_index(&self) -> Option<TrackSegmentIndex> {
        self.next_index(None)
    }

    pub fn last_index(&self) -> Option<TrackSegmentIndex> {
        self.prev_index(None)
    }

    pub fn next_index(&self, cur: Option<TrackSegmentIndex>) -> Option<TrackSegmentIndex> {
        let mut next = cur.map_or_default(|idx| TrackSegmentIndex {
            chunk: idx.chunk,
            pos: idx.pos + 1,
        });
        loop {
            if next.chunk >= self.chunks.len() {
                return None;
            }
            if next.pos == self.chunks[next.chunk].trkpt.len() {
                next.chunk += 1;
                next.pos = 0;
            } else {
                return Some(next);
            }
        }
    }

    pub fn prev_index(&self, cur: Option<TrackSegmentIndex>) -> Option<TrackSegmentIndex> {
        let mut prev = cur.unwrap_or(TrackSegmentIndex {
            chunk: self.chunks.len(),
            pos: 0,
        });
        loop {
            if prev.pos == 0 {
                if prev.chunk == 0 {
                    return None;
                }
                prev.chunk -= 1;
                prev.pos = self.chunks[prev.chunk].trkpt.len();
            } else {
                prev.pos -= 1;
                return Some(prev);
            }
        }
    }

    pub fn to_flat_index(&self, idx: TrackSegmentIndex) -> usize {
        idx.pos
            + if idx.chunk > 0 {
                self.cumul_length[idx.chunk - 1]
            } else {
                0
            }
    }

    fn locate(&self, idx: usize) -> Option<TrackSegmentIndex> {
        let chunk = self.cumul_length.partition_point(|l| idx >= *l);
        if chunk >= self.chunks.len() {
            return None;
        }
        let pos = if chunk > 0 {
            idx - self.cumul_length[chunk - 1]
        } else {
            idx
        };
        if pos >= self.chunks[chunk].trkpt.len() {
            None
        } else {
            Some(TrackSegmentIndex { chunk, pos })
        }
    }
}

impl Index<TrackSegmentIndex> for TrackSegment {
    type Output = Trackpoint;

    fn index(&self, idx: TrackSegmentIndex) -> &Self::Output {
        &self.chunks[idx.chunk].trkpt[idx.pos]
    }
}

impl Index<usize> for TrackSegment {
    type Output = Trackpoint;

    fn index(&self, idx: usize) -> &Self::Output {
        &self[self.locate(idx).unwrap()]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, PartialOrd, Ord)]
pub struct TrackSegmentIndex {
    pub chunk: usize,
    pub pos: usize,
}

#[derive(Debug, Clone)]
pub struct TrackSegmentIterator<'a> {
    trkseg: &'a TrackSegment,
    idx: Option<TrackSegmentIndex>,
}

impl<'a> TrackSegmentIterator<'a> {
    pub fn new(trkseg: &'a TrackSegment) -> Self {
        Self {
            trkseg,
            idx: Default::default(),
        }
    }
}

impl<'a> Iterator for TrackSegmentIterator<'a> {
    type Item = &'a Trackpoint;

    fn next(&mut self) -> Option<Self::Item> {
        self.idx = self.trkseg.next_index(self.idx);
        self.idx.map(|idx| &self.trkseg[idx])
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        let idx = self
            .idx
            .map_or_default(|idx| self.trkseg.to_flat_index(idx))
            + n;
        self.idx = self.trkseg.locate(idx);
        self.idx.map(|idx| &self.trkseg[idx])
    }
}

#[cfg(test)]
mod tests {
    use crate::gpx::TrackpointChunk;

    use super::*;

    fn create_track_segment(nb_chunks: usize) -> TrackSegment {
        let mut trkseg = TrackSegment::default();
        let mut count = 0;
        for n in 1..=nb_chunks {
            let mut chunk = TrackpointChunk::default();
            for _ in 0..n {
                let mut trkpt = Trackpoint::default();
                trkpt.ele = count as f64;
                chunk.trkpt.push(trkpt);
                count += 1;
            }
            trkseg.push(chunk);
        }
        trkseg
    }

    #[test]
    fn test_len() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        assert_eq!(trkseg.len(), nb_chunks * (nb_chunks + 1) / 2);
    }

    #[test]
    fn test_locate() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        for i in 0..trkseg.len() {
            let idx = trkseg.locate(i);
            assert!(idx.is_some());
            assert_eq!(trkseg[idx.unwrap()].ele, i as f64);
        }

        assert!(trkseg.locate(trkseg.len()).is_none());
    }

    #[test]
    fn test_index() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        for i in 0..trkseg.len() {
            assert_eq!(trkseg[i].ele, i as f64);
        }
    }

    #[test]
    #[should_panic]
    fn test_index_out_of_bounds_1() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        trkseg[trkseg.len()].ele;
    }

    #[test]
    #[should_panic]
    fn test_index_out_of_bounds_2() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        trkseg[TrackSegmentIndex {
            chunk: trkseg.chunks.len(),
            pos: 0,
        }]
        .ele;
    }

    #[test]
    fn test_iter() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        for (i, trkpt) in trkseg.iter().enumerate() {
            assert!(std::ptr::eq(&trkseg[i], trkpt));
        }
    }

    #[test]
    fn test_iter_nth() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        let tenth = trkseg.iter().nth(10);
        assert!(tenth.is_some());
        assert!(std::ptr::eq(&trkseg[10], tenth.unwrap()));
    }

    #[test]
    fn test_iter_skip() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        for (i, trkpt) in trkseg.iter().enumerate().skip(5) {
            assert!(std::ptr::eq(&trkseg[i], trkpt));
        }
    }
}
