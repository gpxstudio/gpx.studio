use std::ops::Deref;
use std::rc::Rc;

use crate::{ChunkIndex, Chunked, ChunkedIter, Trackpoint, TrackpointChunk, compute_anchors};

use super::common::uuid_id;

uuid_id!(TrackSegmentId);

uuid_id!(TrackSegmentRevisionId);

#[derive(Debug, Default, Clone)]
pub struct TrackSegment {
    pub id: TrackSegmentId,
    pub rev_id: TrackSegmentRevisionId,
    points: Chunked<TrackpointChunk>,
}

/// The position of a trackpoint in a segment.
pub type TrackSegmentIndex = ChunkIndex;

pub type TrackSegmentIterator<'a> = ChunkedIter<'a, TrackpointChunk>;

impl Deref for TrackSegment {
    type Target = Chunked<TrackpointChunk>;

    fn deref(&self) -> &Self::Target {
        &self.points
    }
}

impl TrackSegment {
    /// Adds a chunk after the last trackpoint, which is dropped if it is empty.
    pub fn push(&mut self, chunk: TrackpointChunk) {
        self.points.push(chunk);
        self.rev_id = Default::default();
    }

    /// Adds a chunk that is shared with something else after the last trackpoint.
    pub fn push_shared(&mut self, chunk: Rc<TrackpointChunk>) {
        self.points.push_shared(chunk);
        self.rev_id = Default::default();
    }

    /// Applies `f` to the trackpoint at `index`, see [`Chunked::update`]. Panics if there is no
    /// such trackpoint.
    pub fn update(&mut self, index: usize, f: impl FnOnce(&mut Trackpoint)) {
        self.points.update(index, f);
        self.rev_id = Default::default();
    }

    /// Applies `f` to every trackpoint, with its index, see [`Chunked::update_all`].
    pub fn update_all(&mut self, f: impl FnMut(usize, &mut Trackpoint)) {
        self.points.update_all(f);
        self.rev_id = Default::default();
    }

    /// Replaces the points in `start..end` by `points`, see [`Chunked::splice`]. The first and
    /// last trackpoints are anchors afterwards.
    pub fn splice(&mut self, start: usize, end: usize, points: Vec<Trackpoint>) {
        self.points.splice(start, end, points);
        self.rev_id = Default::default();
        self.ensure_end_anchors();
    }

    /// The first and the last trackpoints are always anchors, shown at every zoom level.
    ///
    /// It is done by [`TrackSegment::splice`]; commands that build segments in another way need to
    /// call it.
    pub fn ensure_end_anchors(&mut self) {
        let Some(last) = self.len().checked_sub(1) else {
            return;
        };
        for index in [0, last] {
            if self[index].anchor != Some(0) {
                self.set_anchor(index, 0);
            }
        }
    }

    /// Makes the trackpoint at `index` an anchor shown from the map zoom level `zoom`. Panics if
    /// there is no such trackpoint.
    pub fn set_anchor(&mut self, index: usize, zoom: u8) {
        self.update(index, |trkpt| trkpt.anchor = Some(zoom));
    }

    /// Sets the anchors of the trackpoints from the details of the path of the segment (see
    /// [`compute_anchors`]), forgetting the previous ones.
    pub fn compute_anchors(&mut self) {
        let anchors = compute_anchors(self);
        let mut anchors = anchors.into_iter().peekable();
        self.update_all(|index, trkpt| {
            trkpt.anchor = match anchors.peek() {
                Some(&(anchor, zoom)) if anchor == index => {
                    anchors.next();
                    Some(zoom)
                }
                _ => None,
            };
        });
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::Chunk;

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

    fn anchors(trkseg: &TrackSegment) -> Vec<Option<u8>> {
        trkseg.iter().map(|p| p.anchor).collect()
    }

    #[test]
    fn test_splice_keeps_the_ends_anchors() {
        let mut trkseg = TrackSegment::default();
        assert_eq!(anchors(&trkseg), vec![]);
        trkseg.splice(0, 0, points(&[0.0, 1.0, 2.0]));
        assert_eq!(anchors(&trkseg), [Some(0), None, Some(0)]);

        // new ends: the previous ones stay anchors
        trkseg.splice(3, 3, points(&[3.0]));
        trkseg.splice(0, 0, points(&[-1.0]));
        assert_eq!(anchors(&trkseg), [Some(0), Some(0), None, Some(0), Some(0)]);

        // removing the ends: the new ones become anchors
        trkseg.splice(4, 5, vec![]);
        trkseg.splice(0, 2, vec![]);
        assert_eq!(anchors(&trkseg), [Some(0), Some(0)]);

        // a single point is both ends
        trkseg.splice(1, 2, vec![]);
        assert_eq!(anchors(&trkseg), [Some(0)]);
    }

    #[test]
    fn test_compute_anchors_replaces_the_previous_ones() {
        let mut trkseg = TrackSegment::default();
        let line: Vec<_> = (0..10)
            .map(|i| Trackpoint {
                coordinates: crate::LngLat {
                    lng: i as f64 * 0.001,
                    lat: 0.0,
                },
                anchor: Some(5),
                ..Default::default()
            })
            .collect();
        trkseg.splice(0, 0, line);
        trkseg.compute_anchors();
        let mut expected = vec![None; 10];
        expected[0] = Some(0);
        expected[9] = Some(0);
        assert_eq!(anchors(&trkseg), expected);
    }

    #[test]
    fn test_splice_keeps_untouched_chunks_shared() {
        let mut trkseg = create_track_segment(5);
        // the ends are anchors already, or their chunks would be copied
        trkseg.ensure_end_anchors();
        let before = trkseg.chunks().to_vec();
        // inside the third chunk only
        trkseg.splice(4, 5, points(&[-1.0]));
        assert!(Rc::ptr_eq(&trkseg.chunks()[0], &before[0]));
        assert!(Rc::ptr_eq(&trkseg.chunks()[1], &before[1]));
        assert!(Rc::ptr_eq(trkseg.chunks().last().unwrap(), &before[4]));
        assert!(Rc::ptr_eq(
            &trkseg.chunks()[trkseg.chunks().len() - 2],
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
        assert!(trkseg.chunks().len() <= 3);
        assert!(trkseg.chunks().iter().all(|c| c.trkpt.len() <= 4096));
        assert_eq!(trkseg[9_999].ele, 9_999.0);
        assert_eq!(trkseg.len(), 10_000);
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
            chunk: trkseg.chunks().len(),
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

    fn points_of(n: usize) -> Vec<Trackpoint> {
        (0..n).map(|_| Trackpoint::default()).collect()
    }

    #[test]
    fn test_every_change_gives_a_new_revision() {
        type Change = (&'static str, fn(&mut TrackSegment));
        let changes: [Change; 7] = [
            ("push", |s| s.push(TrackpointChunk::new(points_of(1)))),
            ("push_shared", |s| {
                s.push_shared(Rc::new(TrackpointChunk::new(points_of(1))))
            }),
            ("update", |s| s.update(0, |p| p.ele += 1.0)),
            ("update_all", |s| s.update_all(|_, p| p.ele += 1.0)),
            ("splice", |s| s.splice(1, 2, points_of(2))),
            ("set_anchor", |s| s.set_anchor(1, 5)),
            ("compute_anchors", |s| s.compute_anchors()),
        ];
        for (name, change) in changes {
            let mut trkseg = create_track_segment(3);
            let before = trkseg.rev_id;
            change(&mut trkseg);
            assert_ne!(trkseg.rev_id, before, "{name}");
        }
        // reading does not
        let trkseg = create_track_segment(3);
        let before = trkseg.rev_id;
        let _ = trkseg.iter().count();
        assert_eq!(trkseg.rev_id, before);
    }

    #[test]
    fn test_ends_are_anchors_after_a_splice() {
        let mut trkseg = create_track_segment(3);
        trkseg.splice(0, 1, points_of(2));
        let last = trkseg.len() - 1;
        assert_eq!(trkseg[0].anchor, Some(0));
        assert_eq!(trkseg[last].anchor, Some(0));

        // nothing to anchor in an empty segment
        let mut empty = TrackSegment::default();
        empty.ensure_end_anchors();
        assert!(empty.is_empty());
    }
}
