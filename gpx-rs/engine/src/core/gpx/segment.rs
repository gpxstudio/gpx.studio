use std::{ops::Index, rc::Rc};

use uuid::Uuid;

use crate::{Trackpoint, TrackpointChunk};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TrackSegmentId(pub Uuid);

impl Default for TrackSegmentId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TrackSegmentRevisionId(pub Uuid);

impl Default for TrackSegmentRevisionId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct TrackSegment {
    pub id: TrackSegmentId,
    pub rev_id: TrackSegmentRevisionId,
    chunks: Vec<Rc<TrackpointChunk>>,
    cumul_length: Vec<usize>,
}

impl TrackSegment {
    pub fn push(&mut self, chunk: TrackpointChunk) {
        self.push_shared(Rc::new(chunk));
    }

    fn push_shared(&mut self, chunk: Rc<TrackpointChunk>) {
        if chunk.trkpt.is_empty() {
            return;
        }
        self.cumul_length
            .push(self.cumul_length.last().copied().unwrap_or_default() + chunk.trkpt.len());
        self.chunks.push(chunk);
    }

    /// Replaces the points in `start..end` by `points`. Panics if the range is out of bounds.
    ///
    /// Chunks that are not concerned are kept as they are (shared), only the chunks around the
    /// range are copied and refilled.
    pub fn splice(&mut self, start: usize, end: usize, points: Vec<Trackpoint>) {
        assert!(
            start <= end && end <= self.len(),
            "splice range out of bounds"
        );
        let old = std::mem::take(&mut self.chunks);
        self.cumul_length.clear();

        let mut pending = TrackpointChunk::default();
        let mut inserted = false;
        let mut offset = 0;
        for chunk in old {
            let (lo, hi) = (offset, offset + chunk.trkpt.len());
            offset = hi;
            // a chunk ending at `start` is extended unless it is full, to avoid tiny chunks
            if hi < start || (hi == start && chunk.is_full()) {
                self.push_shared(chunk);
                continue;
            }
            if !inserted {
                self.fill(&mut pending, chunk.trkpt[..start - lo].iter().cloned());
                self.fill(&mut pending, points.iter().cloned());
                inserted = true;
            }
            if hi <= end {
                continue;
            }
            if lo >= end {
                self.flush(&mut pending);
                self.push_shared(chunk);
            } else {
                self.fill(&mut pending, chunk.trkpt[end - lo..].iter().cloned());
            }
        }
        if !inserted {
            self.fill(&mut pending, points);
        }
        self.flush(&mut pending);
    }

    fn fill(
        &mut self,
        pending: &mut TrackpointChunk,
        points: impl IntoIterator<Item = Trackpoint>,
    ) {
        for trkpt in points {
            pending.trkpt.push(trkpt);
            if pending.is_full() {
                self.flush(pending);
            }
        }
    }

    fn flush(&mut self, pending: &mut TrackpointChunk) {
        self.push(std::mem::take(pending));
    }

    pub fn len(&self) -> usize {
        self.cumul_length.last().copied().unwrap_or_default()
    }

    pub fn is_empty(&self) -> bool {
        self.chunks.is_empty()
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
            flat: idx.flat + 1,
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
            flat: self.cumul_length.last().copied().unwrap_or_default(),
        });
        if prev.pos == 0 {
            while prev.chunk > 0 {
                prev.chunk -= 1;
                if !self.chunks[prev.chunk].trkpt.is_empty() {
                    prev.pos = self.chunks[prev.chunk].trkpt.len() - 1;
                    prev.flat -= 1;
                    return Some(prev);
                }
            }
            None
        } else {
            prev.pos -= 1;
            prev.flat -= 1;
            Some(prev)
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
            Some(TrackSegmentIndex {
                chunk,
                pos,
                flat: idx,
            })
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
    pub flat: usize,
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
        let idx = self.idx.map_or_default(|idx| idx.flat) + n;
        self.idx = self.trkseg.locate(idx);
        self.idx.map(|idx| &self.trkseg[idx])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_track_segment(nb_chunks: usize) -> TrackSegment {
        let mut trkseg = TrackSegment::default();
        let mut count = 0;
        for n in 1..=nb_chunks {
            let mut chunk = TrackpointChunk::default();
            for _ in 0..n {
                chunk.trkpt.push(Trackpoint {
                    ele: count as f64,
                    ..Default::default()
                });
                count += 1;
            }
            trkseg.push(chunk);
        }
        trkseg
    }

    fn eles(trkseg: &TrackSegment) -> Vec<f64> {
        trkseg.iter().map(|p| p.ele).collect()
    }

    fn points(eles: &[f64]) -> Vec<Trackpoint> {
        eles.iter()
            .map(|&ele| Trackpoint {
                ele,
                ..Default::default()
            })
            .collect()
    }

    #[test]
    fn test_splice_replace_insert_delete_append() {
        // chunks of 1..=5 points: [0] [1 2] [3 4 5] [6 7 8 9] [10..=14]
        let mut trkseg = create_track_segment(5);
        trkseg.splice(4, 8, points(&[-1.0, -2.0]));
        let mut expected: Vec<f64> = (0..4).map(f64::from).collect();
        expected.extend([-1.0, -2.0]);
        expected.extend((8..15).map(f64::from));
        assert_eq!(eles(&trkseg), expected);
        assert_eq!(trkseg.len(), expected.len());
        for i in 0..trkseg.len() {
            assert_eq!(trkseg[i].ele, expected[i]);
        }

        trkseg.splice(2, 2, points(&[100.0]));
        expected.insert(2, 100.0);
        assert_eq!(eles(&trkseg), expected);

        trkseg.splice(0, 3, vec![]);
        expected.drain(..3);
        assert_eq!(eles(&trkseg), expected);

        let len = trkseg.len();
        trkseg.splice(len, len, points(&[7.0, 8.0]));
        expected.extend([7.0, 8.0]);
        assert_eq!(eles(&trkseg), expected);

        let len = trkseg.len();
        trkseg.splice(0, len, vec![]);
        assert_eq!(trkseg.len(), 0);
        assert!(trkseg.first_index().is_none());
    }

    #[test]
    fn test_splice_keeps_untouched_chunks_shared() {
        let mut trkseg = create_track_segment(5);
        let before = trkseg.chunks.clone();
        // inside the third chunk only
        trkseg.splice(4, 5, points(&[-1.0]));
        assert!(Rc::ptr_eq(&trkseg.chunks[0], &before[0]));
        assert!(Rc::ptr_eq(&trkseg.chunks[1], &before[1]));
        assert!(Rc::ptr_eq(trkseg.chunks.last().unwrap(), &before[4]));
        assert!(Rc::ptr_eq(
            &trkseg.chunks[trkseg.chunks.len() - 2],
            &before[3]
        ));
    }

    #[test]
    fn test_splice_append_extends_last_chunk_and_respects_max_size() {
        let mut trkseg = TrackSegment::default();
        for i in 0..10_000 {
            let len = trkseg.len();
            trkseg.splice(len, len, points(&[i as f64]));
        }
        assert_eq!(trkseg.len(), 10_000);
        assert!(trkseg.chunks.len() <= 3);
        assert!(trkseg.chunks.iter().all(|c| c.trkpt.len() <= 4096));
        assert_eq!(trkseg[9_999].ele, 9_999.0);
        assert_eq!(*trkseg.cumul_length.last().unwrap(), 10_000);
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
        let _ = trkseg[trkseg.len()];
    }

    #[test]
    #[should_panic]
    fn test_index_out_of_bounds_2() {
        let nb_chunks = 10;
        let trkseg = create_track_segment(nb_chunks);
        let _ = trkseg[TrackSegmentIndex {
            chunk: trkseg.chunks.len(),
            pos: 0,
            flat: 0,
        }];
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

    #[test]
    fn test_first_last_index() {
        assert!(TrackSegment::default().first_index().is_none());
        assert!(TrackSegment::default().last_index().is_none());

        let trkseg = create_track_segment(5); // 15 points in chunks of 1..=5
        let first = trkseg.first_index().unwrap();
        let last = trkseg.last_index().unwrap();
        assert_eq!((first.chunk, first.pos, first.flat), (0, 0, 0));
        assert_eq!((last.chunk, last.pos, last.flat), (4, 4, 14));
        assert_eq!(trkseg[last].ele, 14.0);
        assert_eq!(trkseg.locate(14), Some(last));
        assert!(trkseg.next_index(Some(last)).is_none());
        assert!(trkseg.prev_index(Some(first)).is_none());
    }

    #[test]
    fn test_prev_next_are_inverse() {
        let trkseg = create_track_segment(6);
        let mut idx = trkseg.last_index();
        let mut visited = vec![];
        while let Some(i) = idx {
            assert_eq!(trkseg.locate(i.flat), Some(i));
            visited.push(i.flat);
            idx = trkseg.prev_index(Some(i));
        }
        assert_eq!(visited, (0..trkseg.len()).rev().collect::<Vec<_>>());

        let mut idx = trkseg.first_index();
        while let Some(i) = idx {
            let next = trkseg.next_index(Some(i));
            if let Some(n) = next {
                assert_eq!(trkseg.prev_index(Some(n)), Some(i));
            }
            idx = next;
        }
    }
}
