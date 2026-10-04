use std::rc::Rc;

use crate::{File, Waypoint, WaypointChunk, WaypointId};

/// Inserts waypoints in the file, right after the waypoint `after`, or at the end if there is
/// none (or if it is not in the file).
///
/// Only the chunk holding `after` is cut (when waypoints follow it), all the other chunks are
/// kept as they are.
pub fn insert_waypoints(file: &mut File, after: Option<WaypointId>, waypoints: Vec<Waypoint>) {
    if waypoints.is_empty() {
        return;
    }

    let mut inserted = Vec::new();
    let mut chunk = WaypointChunk::default();
    for wpt in waypoints {
        chunk.wpt.push(wpt);
        if chunk.is_full() {
            inserted.push(Rc::new(std::mem::take(&mut chunk)));
        }
    }
    if !chunk.wpt.is_empty() {
        inserted.push(Rc::new(chunk));
    }

    let position = after.and_then(|after| {
        file.wpt.iter().enumerate().find_map(|(i, chunk)| {
            chunk
                .wpt
                .iter()
                .position(|wpt| wpt.id == after)
                .map(|j| (i, j + 1))
        })
    });
    match position {
        None => file.wpt.extend(inserted),
        Some((i, split)) => {
            let cut = &file.wpt[i];
            let replacement = if split == cut.wpt.len() {
                let mut chunks = vec![cut.clone()];
                chunks.extend(inserted);
                chunks
            } else {
                let part = |wpt: &[Waypoint]| {
                    Rc::new(WaypointChunk {
                        wpt: wpt.to_vec(),
                        ..Default::default()
                    })
                };
                let mut chunks = vec![part(&cut.wpt[..split])];
                chunks.extend(inserted);
                chunks.push(part(&cut.wpt[split..]));
                chunks
            };
            file.wpt.splice(i..=i, replacement);
        }
    }
    file.wpt_rev_id = Default::default();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn waypoint() -> Waypoint {
        Waypoint::default()
    }

    fn file_with(chunks: &[usize]) -> (File, Vec<WaypointId>) {
        let mut file = File::default();
        let mut ids = vec![];
        for n in chunks {
            let wpt: Vec<_> = (0..*n).map(|_| waypoint()).collect();
            ids.extend(wpt.iter().map(|w| w.id));
            file.wpt.push(Rc::new(WaypointChunk {
                wpt,
                ..Default::default()
            }));
        }
        (file, ids)
    }

    fn ids(file: &File) -> Vec<WaypointId> {
        file.wpt
            .iter()
            .flat_map(|chunk| chunk.wpt.iter().map(|w| w.id))
            .collect()
    }

    #[test]
    fn test_insert_at_the_end() {
        let (mut file, before) = file_with(&[2, 1]);
        let rev = file.wpt_rev_id;
        let new = vec![waypoint(), waypoint()];
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        insert_waypoints(&mut file, None, new);
        assert_eq!(ids(&file), [before.clone(), new_ids].concat());
        // the chunks that were there are kept
        assert_eq!(file.wpt.len(), 3);
        assert_ne!(file.wpt_rev_id, rev);
        // an unknown waypoint is an insertion at the end too
        let (mut file, before) = file_with(&[2]);
        let one = waypoint();
        let one_id = one.id;
        insert_waypoints(&mut file, Some(WaypointId::default()), vec![one]);
        assert_eq!(ids(&file), [before, vec![one_id]].concat());
    }

    #[test]
    fn test_insert_after_the_last_waypoint_of_a_chunk_keeps_the_chunks() {
        let (mut file, before) = file_with(&[2, 2]);
        let first = file.wpt[0].clone();
        let one = waypoint();
        let one_id = one.id;
        insert_waypoints(&mut file, Some(before[1]), vec![one]);
        assert_eq!(ids(&file), [&before[..2], &[one_id], &before[2..]].concat());
        // 2 chunks + the inserted one, nothing was cut
        assert_eq!(file.wpt.len(), 3);
        assert!(Rc::ptr_eq(&file.wpt[0], &first));
    }

    #[test]
    fn test_insert_in_the_middle_of_a_chunk_cuts_it() {
        let (mut file, before) = file_with(&[3, 1]);
        let last = file.wpt[1].clone();
        let new = vec![waypoint(), waypoint()];
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        insert_waypoints(&mut file, Some(before[0]), new);
        assert_eq!(
            ids(&file),
            [&before[..1], &new_ids[..], &before[1..]].concat()
        );
        // the cut chunk, the inserted one and the end of the cut one, then the untouched chunk
        assert_eq!(file.wpt.len(), 4);
        assert!(Rc::ptr_eq(&file.wpt[3], &last));
    }

    #[test]
    fn test_insert_nothing() {
        let (mut file, before) = file_with(&[2]);
        let rev = file.wpt_rev_id;
        insert_waypoints(&mut file, Some(before[0]), vec![]);
        assert_eq!(ids(&file), before);
        assert_eq!(file.wpt_rev_id, rev);
    }

    #[test]
    fn test_insert_many_fills_chunks() {
        let mut file = File::default();
        let new: Vec<_> = (0..300).map(|_| waypoint()).collect();
        let new_ids: Vec<_> = new.iter().map(|w| w.id).collect();
        insert_waypoints(&mut file, None, new);
        assert_eq!(ids(&file), new_ids);
        assert_eq!(file.wpt.len(), 3);
        assert!(file.wpt[..2].iter().all(|chunk| chunk.is_full()));
    }
}
