use std::{ops::Index, rc::Rc};

use crate::Chunk;

/// A list of items, stored in [`Chunk`]s that are shared between its versions: editing it only
/// copies the chunks around the change, so that a version costs little more than the change.
///
/// There are no empty chunks.
#[derive(Debug)]
pub struct Chunked<C: Chunk> {
    chunks: Vec<Rc<C>>,
    cumul_length: Vec<usize>,
}

impl<C: Chunk> Clone for Chunked<C> {
    fn clone(&self) -> Self {
        Self {
            chunks: self.chunks.clone(),
            cumul_length: self.cumul_length.clone(),
        }
    }
}

impl<C: Chunk> Default for Chunked<C> {
    fn default() -> Self {
        Self {
            chunks: vec![],
            cumul_length: vec![],
        }
    }
}

/// The position of an item: in which chunk, where in it, and among all the items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, PartialOrd, Ord)]
pub struct ChunkIndex {
    pub chunk: usize,
    pub pos: usize,
    pub flat: usize,
}

impl<C: Chunk> Chunked<C> {
    /// Adds a chunk at the end, which is dropped if it is empty.
    pub fn push(&mut self, chunk: C) {
        self.push_shared(Rc::new(chunk));
    }

    pub fn push_shared(&mut self, chunk: Rc<C>) {
        if chunk.items().is_empty() {
            return;
        }
        self.cumul_length
            .push(self.cumul_length.last().copied().unwrap_or_default() + chunk.items().len());
        self.chunks.push(chunk);
    }

    pub fn chunks(&self) -> &[Rc<C>] {
        &self.chunks
    }

    /// Replaces the items in `start..end` by `items`. Panics if the range is out of bounds.
    ///
    /// Chunks that are not concerned are kept as they are (shared), only the chunks around the
    /// range are copied and refilled.
    pub fn splice(&mut self, start: usize, end: usize, items: Vec<C::Item>) {
        assert!(
            start <= end && end <= self.len(),
            "splice range out of bounds"
        );
        let old = std::mem::take(&mut self.chunks);
        self.cumul_length.clear();

        let mut items = Some(items);
        let mut pending = vec![];
        let mut offset = 0;
        for chunk in old {
            let (lo, hi) = (offset, offset + chunk.items().len());
            offset = hi;
            // a chunk ending at `start` is extended unless it is full, to avoid tiny chunks
            if hi < start || (hi == start && chunk.is_full()) {
                self.push_shared(chunk);
                continue;
            }
            if let Some(items) = items.take() {
                self.fill(&mut pending, chunk.items()[..start - lo].iter().cloned());
                self.fill(&mut pending, items);
            }
            if hi <= end {
                continue;
            }
            if lo >= end {
                self.flush(&mut pending);
                self.push_shared(chunk);
            } else {
                self.fill(&mut pending, chunk.items()[end - lo..].iter().cloned());
            }
        }
        if let Some(items) = items {
            self.fill(&mut pending, items);
        }
        self.flush(&mut pending);
    }

    fn fill(&mut self, pending: &mut Vec<C::Item>, items: impl IntoIterator<Item = C::Item>) {
        for item in items {
            pending.push(item);
            if pending.len() >= C::MAX_SIZE {
                self.flush(pending);
            }
        }
    }

    fn flush(&mut self, pending: &mut Vec<C::Item>) {
        self.push(C::new(std::mem::take(pending)));
    }

    /// Edits the items of the chunks that contain an item accepted by `filter`.
    ///
    /// `f` receives a copy of the items of such a chunk and returns whether it changed them. A
    /// changed chunk is replaced by a new one (so that what is derived from it is computed
    /// again) and the chunks left empty are dropped. The other chunks are kept. Returns whether
    /// anything changed.
    pub fn edit(
        &mut self,
        filter: impl Fn(&C::Item) -> bool,
        mut f: impl FnMut(&mut Vec<C::Item>) -> bool,
    ) -> bool {
        let mut changed = false;
        let old = std::mem::take(&mut self.chunks);
        self.cumul_length.clear();
        for chunk in old {
            if !chunk.items().iter().any(&filter) {
                self.push_shared(chunk);
                continue;
            }
            let mut items = chunk.items().clone();
            if !f(&mut items) {
                self.push_shared(chunk);
                continue;
            }
            changed = true;
            self.push(C::new(items));
        }
        changed
    }

    /// Changes what is in the chunk `chunk`, but not how many items there are. A chunk that is
    /// shared is copied first, so that the other versions do not change.
    fn replace_chunk(&mut self, chunk: usize, f: impl FnOnce(&mut Vec<C::Item>)) {
        let len = self.chunks[chunk].items().len();
        match Rc::get_mut(&mut self.chunks[chunk]) {
            Some(unique) => {
                f(unique.items_mut());
                unique.renew();
            }
            None => {
                let mut items = self.chunks[chunk].items().clone();
                f(&mut items);
                self.chunks[chunk] = Rc::new(C::new(items));
            }
        }
        debug_assert_eq!(self.chunks[chunk].items().len(), len);
    }

    /// Applies `f` to the item at `index`, which is copied in a new chunk. Panics if there is no
    /// such item.
    pub fn update(&mut self, index: usize, f: impl FnOnce(&mut C::Item)) {
        let ChunkIndex { chunk, pos, .. } = self.locate(index).unwrap();
        self.replace_chunk(chunk, |items| f(&mut items[pos]));
    }

    /// Applies `f` to every item, with its index, in new chunks.
    pub fn update_all(&mut self, mut f: impl FnMut(usize, &mut C::Item)) {
        let mut offset = 0;
        for chunk in 0..self.chunks.len() {
            let len = self.chunks[chunk].items().len();
            self.replace_chunk(chunk, |items| {
                for (i, item) in items.iter_mut().enumerate() {
                    f(offset + i, item);
                }
            });
            offset += len;
        }
    }

    pub fn len(&self) -> usize {
        self.cumul_length.last().copied().unwrap_or_default()
    }

    pub fn is_empty(&self) -> bool {
        self.chunks.is_empty()
    }

    pub fn iter(&self) -> ChunkedIter<'_, C> {
        ChunkedIter::new(self)
    }

    pub fn first_index(&self) -> Option<ChunkIndex> {
        self.next_index(None)
    }

    pub fn last_index(&self) -> Option<ChunkIndex> {
        self.prev_index(None)
    }

    pub fn next_index(&self, cur: Option<ChunkIndex>) -> Option<ChunkIndex> {
        let mut next = cur.map_or_default(|idx| ChunkIndex {
            chunk: idx.chunk,
            pos: idx.pos + 1,
            flat: idx.flat + 1,
        });
        loop {
            if next.chunk >= self.chunks.len() {
                return None;
            }
            if next.pos == self.chunks[next.chunk].items().len() {
                next.chunk += 1;
                next.pos = 0;
            } else {
                return Some(next);
            }
        }
    }

    pub fn prev_index(&self, cur: Option<ChunkIndex>) -> Option<ChunkIndex> {
        let mut prev = cur.unwrap_or(ChunkIndex {
            chunk: self.chunks.len(),
            pos: 0,
            flat: self.cumul_length.last().copied().unwrap_or_default(),
        });
        if prev.pos == 0 {
            while prev.chunk > 0 {
                prev.chunk -= 1;
                if !self.chunks[prev.chunk].items().is_empty() {
                    prev.pos = self.chunks[prev.chunk].items().len() - 1;
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

    /// The position of the item `idx` among all the items.
    pub fn locate(&self, idx: usize) -> Option<ChunkIndex> {
        let chunk = self.cumul_length.partition_point(|l| idx >= *l);
        if chunk >= self.chunks.len() {
            return None;
        }
        let pos = if chunk > 0 {
            idx - self.cumul_length[chunk - 1]
        } else {
            idx
        };
        if pos >= self.chunks[chunk].items().len() {
            None
        } else {
            Some(ChunkIndex {
                chunk,
                pos,
                flat: idx,
            })
        }
    }
}

impl<C: Chunk> Index<ChunkIndex> for Chunked<C> {
    type Output = C::Item;

    fn index(&self, idx: ChunkIndex) -> &Self::Output {
        &self.chunks[idx.chunk].items()[idx.pos]
    }
}

impl<C: Chunk> Index<usize> for Chunked<C> {
    type Output = C::Item;

    fn index(&self, idx: usize) -> &Self::Output {
        &self[self.locate(idx).unwrap()]
    }
}

impl<'a, C: Chunk> IntoIterator for &'a Chunked<C> {
    type Item = &'a C::Item;
    type IntoIter = ChunkedIter<'a, C>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

pub struct ChunkedIter<'a, C: Chunk> {
    chunked: &'a Chunked<C>,
    /// The item returned last.
    idx: Option<ChunkIndex>,
    exhausted: bool,
}

impl<C: Chunk> Clone for ChunkedIter<'_, C> {
    fn clone(&self) -> Self {
        Self {
            chunked: self.chunked,
            idx: self.idx,
            exhausted: self.exhausted,
        }
    }
}

impl<'a, C: Chunk> ChunkedIter<'a, C> {
    pub fn new(chunked: &'a Chunked<C>) -> Self {
        Self {
            chunked,
            idx: None,
            exhausted: false,
        }
    }

    fn move_to(&mut self, idx: Option<ChunkIndex>) -> Option<&'a C::Item> {
        self.exhausted = idx.is_none();
        self.idx = idx.or(self.idx);
        idx.map(|idx| &self.chunked[idx])
    }
}

impl<'a, C: Chunk> Iterator for ChunkedIter<'a, C> {
    type Item = &'a C::Item;

    fn next(&mut self) -> Option<Self::Item> {
        if self.exhausted {
            return None;
        }
        let next = self.chunked.next_index(self.idx);
        self.move_to(next)
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        if self.exhausted {
            return None;
        }
        let target = self.idx.map_or(0, |idx| idx.flat + 1).saturating_add(n);
        let next = self.chunked.locate(target);
        self.move_to(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Chunks of at most 3 numbers, with an identity like the real ones.
    #[derive(Debug)]
    struct Numbers {
        id: usize,
        items: Vec<u32>,
    }

    thread_local! {
        static NEXT_ID: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
    }

    fn next_id() -> usize {
        NEXT_ID.with(|id| id.replace(id.get() + 1))
    }

    impl Chunk for Numbers {
        type Item = u32;
        const MAX_SIZE: usize = 3;

        fn new(items: Vec<u32>) -> Self {
            Self {
                id: next_id(),
                items,
            }
        }

        fn renew(&mut self) {
            self.id = next_id();
        }

        fn items(&self) -> &Vec<u32> {
            &self.items
        }

        fn items_mut(&mut self) -> &mut Vec<u32> {
            &mut self.items
        }
    }

    /// The numbers `0..n` in chunks of 3.
    fn numbers(n: u32) -> Chunked<Numbers> {
        let mut chunked = Chunked::default();
        for start in (0..n).step_by(3) {
            chunked.push(Numbers::new((start..(start + 3).min(n)).collect()));
        }
        chunked
    }

    fn values(chunked: &Chunked<Numbers>) -> Vec<u32> {
        chunked.iter().copied().collect()
    }

    fn ids(chunked: &Chunked<Numbers>) -> Vec<usize> {
        chunked.chunks().iter().map(|chunk| chunk.id).collect()
    }

    fn assert_consistent(chunked: &Chunked<Numbers>) {
        let sizes: Vec<usize> = chunked.chunks().iter().map(|c| c.items.len()).collect();
        assert!(
            sizes
                .iter()
                .all(|&size| 0 < size && size <= Numbers::MAX_SIZE)
        );
        assert_eq!(chunked.len(), sizes.iter().sum::<usize>());
        for index in 0..chunked.len() {
            assert_eq!(chunked.locate(index).unwrap().flat, index);
        }
        assert!(chunked.locate(chunked.len()).is_none());
    }

    #[test]
    fn test_push_drops_empty_chunks() {
        let mut chunked = numbers(4);
        chunked.push(Numbers::new(vec![]));
        assert_eq!(chunked.chunks().len(), 2);
        assert_eq!(chunked.len(), 4);
        assert!(Chunked::<Numbers>::default().is_empty());
        assert!(!chunked.is_empty());
    }

    #[test]
    fn test_locate_index_and_iterate() {
        let chunked = numbers(7);
        assert_eq!(
            chunked.locate(4),
            Some(ChunkIndex {
                chunk: 1,
                pos: 1,
                flat: 4
            })
        );
        assert_eq!(chunked[4], 4);
        assert_eq!(chunked[chunked.locate(6).unwrap()], 6);
        assert!(chunked.locate(7).is_none());
        assert_eq!(values(&chunked), (0..7).collect::<Vec<_>>());
        assert_eq!(chunked.iter().count(), 7);
        assert_eq!((&chunked).into_iter().last(), Some(&6));
        assert_eq!(values(&Chunked::default()), Vec::<u32>::new());
    }

    #[test]
    fn test_first_last_next_and_previous_index() {
        let chunked = numbers(7);
        let first = chunked.first_index().unwrap();
        let last = chunked.last_index().unwrap();
        assert_eq!((first.flat, last.flat), (0, 6));
        assert_eq!((last.chunk, last.pos), (2, 0));

        let mut forward = vec![];
        let mut cur = None;
        while let Some(next) = chunked.next_index(cur) {
            forward.push(chunked[next]);
            cur = Some(next);
        }
        assert_eq!(forward, (0..7).collect::<Vec<_>>());

        let mut backward = vec![];
        let mut cur = None;
        while let Some(prev) = chunked.prev_index(cur) {
            backward.push(chunked[prev]);
            cur = Some(prev);
        }
        assert_eq!(backward, (0..7).rev().collect::<Vec<_>>());

        let empty = Chunked::<Numbers>::default();
        assert!(empty.first_index().is_none() && empty.last_index().is_none());
    }

    #[test]
    #[allow(clippy::iter_nth_zero)]
    fn test_iterator_nth_goes_on_from_the_current_item() {
        let chunked = numbers(10);
        let mut iter = chunked.iter();
        assert_eq!(iter.nth(1), Some(&1));
        assert_eq!(iter.next(), Some(&2));
        // skips 3 and 4
        assert_eq!(iter.nth(2), Some(&5));
        assert_eq!(iter.nth(0), Some(&6));
        assert_eq!(iter.nth(2), Some(&9));
        assert_eq!(iter.nth(0), None);
        assert_eq!(iter.next(), None, "an exhausted iterator stays exhausted");

        assert_eq!(values(&numbers(10)).iter().skip(4).count(), 6);
        assert_eq!(
            chunked.iter().skip(4).copied().collect::<Vec<_>>(),
            (4..10).collect::<Vec<_>>()
        );
        assert_eq!(
            chunked.iter().step_by(4).copied().collect::<Vec<_>>(),
            vec![0, 4, 8]
        );
    }

    #[test]
    fn test_splice_replaces_inserts_deletes_and_appends() {
        let mut chunked = numbers(10);
        chunked.splice(2, 5, vec![100, 101]);
        assert_eq!(values(&chunked), [0, 1, 100, 101, 5, 6, 7, 8, 9]);
        assert_consistent(&chunked);

        chunked.splice(0, 0, vec![50]);
        assert_eq!(values(&chunked)[..3], [50, 0, 1]);
        chunked.splice(chunked.len(), chunked.len(), vec![7, 7, 7, 7]);
        assert_eq!(values(&chunked)[chunked.len() - 5..], [9, 7, 7, 7, 7]);
        assert_consistent(&chunked);

        let len = chunked.len();
        chunked.splice(0, len, vec![]);
        assert!(chunked.is_empty());
        assert_eq!(chunked.len(), 0);
    }

    #[test]
    #[should_panic(expected = "splice range out of bounds")]
    fn test_splice_out_of_bounds_panics() {
        numbers(4).splice(2, 5, vec![]);
    }

    #[test]
    fn test_splice_keeps_the_chunks_it_does_not_touch() {
        let mut chunked = numbers(12);
        let before = ids(&chunked);
        // inside the second chunk
        chunked.splice(4, 5, vec![40]);
        let after = ids(&chunked);
        assert_eq!(after.len(), before.len());
        assert_eq!(
            (after[0], after[2], after[3]),
            (before[0], before[2], before[3])
        );
        assert_ne!(after[1], before[1]);
    }

    #[test]
    fn test_edit_replaces_only_the_changed_chunks() {
        let mut chunked = numbers(9);
        let before = ids(&chunked);

        // nothing is changed: nothing is replaced
        assert!(!chunked.edit(|n| *n == 4, |_| false));
        assert_eq!(ids(&chunked), before);

        // the filter picks the chunk, the hook changes it
        assert!(chunked.edit(
            |n| *n == 4,
            |items| {
                items[1] = 400;
                true
            }
        ));
        let after = ids(&chunked);
        assert_eq!((after[0], after[2]), (before[0], before[2]));
        assert_ne!(after[1], before[1]);
        assert_eq!(values(&chunked), [0, 1, 2, 3, 400, 5, 6, 7, 8]);

        // a chunk left empty is dropped
        assert!(chunked.edit(
            |n| *n == 0,
            |items| {
                items.clear();
                true
            }
        ));
        assert_eq!(chunked.chunks().len(), 2);
        assert_consistent(&chunked);
    }

    #[test]
    fn test_update_copies_the_chunk_so_that_other_versions_do_not_change() {
        let mut chunked = numbers(6);
        let version = chunked.clone();
        let before = ids(&chunked);
        chunked.update(4, |n| *n = 40);
        assert_eq!(values(&chunked), [0, 1, 2, 3, 40, 5]);
        assert_eq!(values(&version), (0..6).collect::<Vec<_>>());
        assert_eq!(ids(&version), before);
        assert_eq!(ids(&chunked)[0], before[0]);
        assert_ne!(ids(&chunked)[1], before[1]);
    }

    #[test]
    fn test_updated_chunks_get_a_new_identity_even_when_nothing_shares_them() {
        // what is derived from or kept of a chunk is keyed by its identity
        let mut chunked = numbers(6);
        let before = ids(&chunked);
        chunked.update(1, |n| *n += 1);
        assert_ne!(ids(&chunked)[0], before[0]);
        assert_eq!(ids(&chunked)[1], before[1]);

        let before = ids(&chunked);
        chunked.update_all(|_, n| *n += 1);
        let after = ids(&chunked);
        assert!(before.iter().zip(&after).all(|(a, b)| a != b));
    }

    #[test]
    fn test_update_all_gives_the_index_of_each_item() {
        let mut chunked = numbers(8);
        let mut seen = vec![];
        chunked.update_all(|index, n| {
            seen.push(index);
            *n = 10 * index as u32;
        });
        assert_eq!(seen, (0..8).collect::<Vec<_>>());
        assert_eq!(values(&chunked), [0, 10, 20, 30, 40, 50, 60, 70]);
    }
}
