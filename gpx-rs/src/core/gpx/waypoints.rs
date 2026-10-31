use std::ops::Deref;

use crate::{Chunked, Waypoint, WaypointChunk, WaypointId};

use super::common::uuid_id;

uuid_id!(FileWaypointsRevisionId);

/// The waypoints of a file, in chunks that are shared between the versions of the file (see
/// [`Chunked`]).
///
/// Everything that changes the waypoints changes the revision too, which is why there is no
/// mutable access to the list itself: the revision tells what is derived from the waypoints
/// (coordinates for the map...) that it is out of date.
#[derive(Debug, Default, Clone)]
pub struct Waypoints {
    chunks: Chunked<WaypointChunk>,
    /// Changes when the waypoints do.
    pub rev_id: FileWaypointsRevisionId,
}

impl Deref for Waypoints {
    type Target = Chunked<WaypointChunk>;

    fn deref(&self) -> &Self::Target {
        &self.chunks
    }
}

impl Waypoints {
    /// Waypoints made of the given chunks, which are used as they are.
    pub fn new(chunks: impl IntoIterator<Item = WaypointChunk>) -> Self {
        let mut waypoints = Self::default();
        for chunk in chunks {
            waypoints.push(chunk);
        }
        waypoints
    }

    /// Adds a chunk after the last waypoint.
    pub fn push(&mut self, chunk: WaypointChunk) {
        self.chunks.push(chunk);
        self.rev_id = Default::default();
    }

    /// Adds a chunk that is shared with something else after the last waypoint.
    pub fn push_shared(&mut self, chunk: std::rc::Rc<WaypointChunk>) {
        self.chunks.push_shared(chunk);
        self.rev_id = Default::default();
    }

    /// Replaces the waypoints in `start..end` by `waypoints`, see [`Chunked::splice`].
    pub fn splice(&mut self, start: usize, end: usize, waypoints: Vec<Waypoint>) {
        self.chunks.splice(start, end, waypoints);
        self.rev_id = Default::default();
    }

    /// Inserts waypoints, so that the first one is at `index` among the waypoints (at the end if
    /// the index is past it). Only the chunks around the insertion are copied.
    pub fn insert_at(&mut self, index: usize, waypoints: Vec<Waypoint>) {
        if waypoints.is_empty() {
            return;
        }
        let index = index.min(self.len());
        self.splice(index, index, waypoints);
    }

    /// Inserts waypoints right after the waypoint `after`, or at the end if there is none (or if
    /// it is not there). See [`Waypoints::insert_at`].
    pub fn insert_after(&mut self, after: Option<WaypointId>, waypoints: Vec<Waypoint>) {
        let index = after
            .and_then(|after| self.position(after))
            .map_or(usize::MAX, |i| i + 1);
        self.insert_at(index, waypoints);
    }

    /// The position of the waypoint among the waypoints.
    pub fn position(&self, id: WaypointId) -> Option<usize> {
        self.iter().position(|wpt| wpt.id == id)
    }

    /// Edits the waypoints of the chunks that contain one accepted by `filter`, see
    /// [`Chunked::edit`]. Returns whether anything changed.
    pub fn edit(
        &mut self,
        filter: impl Fn(&Waypoint) -> bool,
        f: impl FnMut(&mut Vec<Waypoint>) -> bool,
    ) -> bool {
        let changed = self.chunks.edit(filter, f);
        if changed {
            self.rev_id = Default::default();
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use super::*;

    fn waypoint() -> Waypoint {
        Waypoint::default()
    }

    fn waypoints_with(chunks: &[usize]) -> (Waypoints, Vec<WaypointId>) {
        let mut waypoints = Waypoints::default();
        let mut ids = vec![];
        for n in chunks {
            let wpt: Vec<_> = (0..*n).map(|_| waypoint()).collect();
            ids.extend(wpt.iter().map(|w| w.id));
            waypoints.push(WaypointChunk {
                wpt,
                ..Default::default()
            });
        }
        (waypoints, ids)
    }

    fn ids(waypoints: &Waypoints) -> Vec<WaypointId> {
        waypoints.iter().map(|w| w.id).collect()
    }

    #[test]
    fn test_new_and_push() {
        let (waypoints, ids_) = waypoints_with(&[2, 1]);
        assert_eq!(waypoints.len(), 3);
        assert_eq!(waypoints.chunks().len(), 2);
        assert_eq!(ids(&waypoints), ids_);
        assert_eq!(waypoints.position(ids_[2]), Some(2));
        assert_eq!(waypoints.position(WaypointId::default()), None);
        // empty chunks are dropped
        let waypoints = Waypoints::new([WaypointChunk::default()]);
        assert!(waypoints.is_empty());
    }

    #[test]
    fn test_insert_at_the_end() {
        let (mut waypoints, before) = waypoints_with(&[2, 1]);
        let first = waypoints.chunks()[0].clone();
        let rev = waypoints.rev_id;
        let new = vec![waypoint(), waypoint()];
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        waypoints.insert_after(None, new);
        assert_eq!(ids(&waypoints), [before.clone(), new_ids].concat());
        // the chunk that is not touched is kept, the last one is extended
        assert_eq!(waypoints.chunks().len(), 2);
        assert!(Rc::ptr_eq(&waypoints.chunks()[0], &first));
        assert_ne!(waypoints.rev_id, rev);
        // an unknown waypoint is an insertion at the end too
        let (mut waypoints, before) = waypoints_with(&[2]);
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_after(Some(WaypointId::default()), vec![one]);
        assert_eq!(ids(&waypoints), [before, vec![one_id]].concat());
    }

    #[test]
    fn test_insert_after_the_last_waypoint_of_a_chunk_keeps_the_next_ones() {
        let (mut waypoints, before) = waypoints_with(&[2, 2]);
        let last = waypoints.chunks()[1].clone();
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_after(Some(before[1]), vec![one]);
        assert_eq!(
            ids(&waypoints),
            [&before[..2], &[one_id], &before[2..]].concat()
        );
        assert_eq!(waypoints.chunks().len(), 2);
        assert!(Rc::ptr_eq(&waypoints.chunks()[1], &last));
    }

    #[test]
    fn test_insert_in_the_middle_of_a_chunk_cuts_it() {
        let (mut waypoints, before) = waypoints_with(&[3, 1]);
        let last = waypoints.chunks()[1].clone();
        let new = vec![waypoint(), waypoint()];
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        waypoints.insert_after(Some(before[0]), new);
        assert_eq!(
            ids(&waypoints),
            [&before[..1], &new_ids[..], &before[1..]].concat()
        );
        // the cut chunk is refilled, the other one is kept
        assert_eq!(waypoints.chunks().len(), 2);
        assert!(Rc::ptr_eq(&waypoints.chunks()[1], &last));
    }

    #[test]
    fn test_insert_nothing() {
        let (mut waypoints, before) = waypoints_with(&[2]);
        let rev = waypoints.rev_id;
        waypoints.insert_after(Some(before[0]), vec![]);
        assert_eq!(ids(&waypoints), before);
        assert_eq!(waypoints.rev_id, rev);
    }

    #[test]
    fn test_insert_many_fills_chunks() {
        let mut waypoints = Waypoints::default();
        let new: Vec<_> = (0..300).map(|_| waypoint()).collect();
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        waypoints.insert_after(None, new);
        assert_eq!(ids(&waypoints), new_ids);
        assert_eq!(waypoints.chunks().len(), 3);
        assert!(waypoints.chunks()[..2].iter().all(|chunk| {
            use crate::Chunk;
            chunk.is_full()
        }));
    }

    #[test]
    fn test_insert_at_an_index() {
        // at the start
        let (mut waypoints, before) = waypoints_with(&[2, 1]);
        let first = waypoints.chunks()[0].clone();
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_at(0, vec![one]);
        assert_eq!(ids(&waypoints), [vec![one_id], before.clone()].concat());
        // the existing chunks are kept
        assert_eq!(waypoints.chunks().len(), 3);
        assert!(Rc::ptr_eq(&waypoints.chunks()[1], &first));

        // between two chunks
        let (mut waypoints, before) = waypoints_with(&[2, 1]);
        let last = waypoints.chunks()[1].clone();
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_at(2, vec![one]);
        assert_eq!(
            ids(&waypoints),
            [&before[..2], &[one_id], &before[2..]].concat()
        );
        assert!(Rc::ptr_eq(&waypoints.chunks()[1], &last));

        // inside a chunk
        let (mut waypoints, before) = waypoints_with(&[3]);
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_at(1, vec![one]);
        assert_eq!(
            ids(&waypoints),
            [&before[..1], &[one_id], &before[1..]].concat()
        );

        // at the end, or past it
        for index in [3, 100, usize::MAX] {
            let (mut waypoints, before) = waypoints_with(&[3]);
            let one = waypoint();
            let one_id = one.id;
            waypoints.insert_at(index, vec![one]);
            assert_eq!(ids(&waypoints), [before, vec![one_id]].concat());
        }

        // in a file without waypoints
        let mut waypoints = Waypoints::default();
        let one = waypoint();
        let one_id = one.id;
        waypoints.insert_at(0, vec![one]);
        assert_eq!(ids(&waypoints), vec![one_id]);
    }

    #[test]
    fn test_splice_replaces_waypoints() {
        let (mut waypoints, before) = waypoints_with(&[2, 2]);
        let rev = waypoints.rev_id;
        waypoints.splice(1, 3, vec![]);
        assert_eq!(ids(&waypoints), [before[0], before[3]]);
        assert_ne!(waypoints.rev_id, rev);
    }

    #[test]
    fn test_edit_changes_the_chunks_with_a_match_only() {
        let (mut waypoints, before) = waypoints_with(&[2, 2, 1]);
        let (first, last) = (waypoints.chunks()[0].clone(), waypoints.chunks()[2].clone());
        let rev = waypoints.rev_id;
        let target = before[2];
        let changed = waypoints.edit(
            |wpt| wpt.id == target,
            |wpts| {
                wpts.retain(|wpt| wpt.id != target);
                true
            },
        );
        assert!(changed);
        assert_ne!(waypoints.rev_id, rev);
        assert_eq!(ids(&waypoints), [&before[..2], &before[3..]].concat());
        // the chunks without a match are the same ones, the changed one is new
        assert!(Rc::ptr_eq(&waypoints.chunks()[0], &first));
        assert!(Rc::ptr_eq(&waypoints.chunks()[2], &last));
        assert_eq!(waypoints.chunks().len(), 3);

        // a chunk left empty is dropped
        let (mut waypoints, before) = waypoints_with(&[1, 2]);
        waypoints.edit(
            |wpt| wpt.id == before[0],
            |wpts| {
                wpts.clear();
                true
            },
        );
        assert_eq!(waypoints.chunks().len(), 1);
        assert_eq!(ids(&waypoints), before[1..]);

        // a chunk that is not changed is kept, and so is the revision
        let (mut waypoints, before) = waypoints_with(&[2]);
        let (chunk, rev) = (waypoints.chunks()[0].clone(), waypoints.rev_id);
        assert!(!waypoints.edit(|wpt| wpt.id == before[0], |_| false));
        assert!(Rc::ptr_eq(&waypoints.chunks()[0], &chunk));
        assert_eq!(waypoints.rev_id, rev);
        assert!(!waypoints.edit(|_| false, |_| true));
    }
}
