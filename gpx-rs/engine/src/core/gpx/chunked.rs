use std::{ops::Index, rc::Rc};

use crate::Chunk;

/// A list of items, stored in [`Chunk`]s that are shared between its versions: editing it only
/// copies the chunks around the change, so that a version costs little more than the change.
///
/// There are no empty chunks.
#[derive(Debug, PartialEq)]
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
            Some(unique) => f(unique.items_mut()),
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
    idx: Option<ChunkIndex>,
}

impl<C: Chunk> Clone for ChunkedIter<'_, C> {
    fn clone(&self) -> Self {
        Self {
            chunked: self.chunked,
            idx: self.idx,
        }
    }
}

impl<'a, C: Chunk> ChunkedIter<'a, C> {
    pub fn new(chunked: &'a Chunked<C>) -> Self {
        Self {
            chunked,
            idx: Default::default(),
        }
    }
}

impl<'a, C: Chunk> Iterator for ChunkedIter<'a, C> {
    type Item = &'a C::Item;

    fn next(&mut self) -> Option<Self::Item> {
        self.idx = self.chunked.next_index(self.idx);
        self.idx.map(|idx| &self.chunked[idx])
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        let idx = self.idx.map_or_default(|idx| idx.flat) + n;
        self.idx = self.chunked.locate(idx);
        self.idx.map(|idx| &self.chunked[idx])
    }
}
