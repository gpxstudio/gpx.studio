use std::{collections::HashSet, rc::Rc};

use crate::{Apply, CommandError, File, Selection, State, Track, TrackSegment};

#[derive(Debug)]
pub struct Duplicate;

impl Apply for Duplicate {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let next = match &*state.selection {
            Selection::File { file_ids } => {
                let mut copies = HashSet::new();
                let mut order = Vec::with_capacity(state.order.0.len() + file_ids.len());
                for id in &state.order.0 {
                    order.push(*id);
                    let Some(file) = state.files.get(id).filter(|_| file_ids.contains(id)) else {
                        continue;
                    };
                    let copy = copy_file(file);
                    order.push(copy.id);
                    copies.insert(copy.id);
                    state.files.insert(copy.id, Rc::new(copy));
                }
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                state.order.0 = order;
                Selection::File { file_ids: copies }
            }
            Selection::Track { file_id, trk_ids } => {
                let file = state
                    .files
                    .get_mut(file_id)
                    .ok_or(CommandError::NothingToDo)?;
                let file = Rc::make_mut(file);
                let mut copies = HashSet::new();
                duplicate_after(
                    &mut file.trk,
                    |trk| trk_ids.contains(&trk.id),
                    |trk| {
                        let copy = copy_track(trk);
                        copies.insert(copy.id);
                        copy
                    },
                );
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                Selection::Track {
                    file_id: *file_id,
                    trk_ids: copies,
                }
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => {
                let file = state
                    .files
                    .get_mut(file_id)
                    .ok_or(CommandError::NothingToDo)?;
                let file = Rc::make_mut(file);
                let trk = file
                    .trk
                    .iter_mut()
                    .find(|trk| trk.id == *trk_id)
                    .ok_or(CommandError::NothingToDo)?;
                let mut copies = HashSet::new();
                duplicate_after(
                    &mut trk.trkseg,
                    |seg| trkseg_ids.contains(&seg.id),
                    |seg| {
                        let copy = copy_segment(seg);
                        copies.insert(copy.id);
                        copy
                    },
                );
                if copies.is_empty() {
                    return Err(CommandError::NothingToDo);
                }
                Selection::TrackSegment {
                    file_id: *file_id,
                    trk_id: *trk_id,
                    trkseg_ids: copies,
                }
            }
            // TODO waypoints
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => {
                return Err(CommandError::NothingToDo);
            }
        };
        *state.selection = next;
        Ok(())
    }
}

/// Inserts a copy right after each item matching `filter`.
fn duplicate_after<T>(
    items: &mut Vec<T>,
    filter: impl Fn(&T) -> bool,
    mut copy: impl FnMut(&T) -> T,
) {
    let old = std::mem::take(items);
    for item in old {
        let dup = filter(&item).then(|| copy(&item));
        items.push(item);
        items.extend(dup);
    }
}

// Track points are shared chunks, so copies are cheap.
fn copy_segment(segment: &TrackSegment) -> TrackSegment {
    let mut copy = segment.clone();
    copy.id = Default::default();
    copy
}

fn copy_track(track: &Track) -> Track {
    Track {
        id: Default::default(),
        trkseg: track.trkseg.iter().map(copy_segment).collect(),
        ..track.clone()
    }
}

fn copy_file(file: &File) -> File {
    let mut copy = File {
        id: Default::default(),
        trk: file.trk.iter().map(copy_track).collect(),
        ..file.clone()
    };
    copy.info.name = format!("{} (copy)", file.info.name);
    copy
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;
    use crate::{FileId, Load};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let id = fx.order.0[0];
        (fx, id)
    }

    #[test]
    fn test_duplicate_nothing_selected() {
        let mut fx = Fixture::default();
        assert_eq!(
            Duplicate.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_duplicate_file() {
        let (mut fx, id) = loaded();
        Duplicate.apply(&mut fx.state()).unwrap();
        assert_eq!(fx.files.len(), 2);
        let copy_id = fx.order.0[1];
        assert_eq!(fx.selected_files(), [copy_id].into());
        let (orig, copy) = (&fx.files[&id], &fx.files[&copy_id]);
        assert_ne!(copy_id, id);
        assert_eq!(copy.info.name, format!("{} (copy)", orig.info.name));
        assert_eq!(copy.trk.len(), orig.trk.len());
        for (a, b) in orig.trk.iter().zip(&copy.trk) {
            assert_ne!(a.id, b.id);
            assert_eq!(a.info, b.info);
            for (a, b) in a.trkseg.iter().zip(&b.trkseg) {
                assert_ne!(a.id, b.id);
                assert_eq!(a.len(), b.len());
            }
        }
    }

    #[test]
    fn test_duplicate_track_inserts_after_original() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].trk.len();
        let trk_id = fx.files[&id].trk[0].id;
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [trk_id].into(),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        let file = &fx.files[&id];
        assert_eq!(file.trk.len(), before + 1);
        assert_eq!(file.trk[0].id, trk_id);
        assert_ne!(file.trk[1].id, trk_id);
        assert!(
            matches!(&fx.selection, Selection::Track { trk_ids, .. } if trk_ids.contains(&file.trk[1].id))
        );
    }

    #[test]
    fn test_duplicate_segment_inserts_after_original() {
        let (mut fx, id) = loaded();
        let trk = &fx.files[&id].trk[0];
        let (trk_id, seg_id, before) = (trk.id, trk.trkseg[0].id, trk.trkseg.len());
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id,
            trkseg_ids: [seg_id].into(),
        };
        Duplicate.apply(&mut fx.state()).unwrap();
        let trk = &fx.files[&id].trk[0];
        assert_eq!(trk.trkseg.len(), before + 1);
        assert_eq!(trk.trkseg[0].id, seg_id);
        assert_ne!(trk.trkseg[1].id, seg_id);
        assert_eq!(trk.trkseg[0].len(), trk.trkseg[1].len());
    }
}
