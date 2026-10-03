use std::rc::Rc;

use crate::{Apply, CommandError, File, FileId, LngLat, Selection, State, Trackpoint};

/// Replaces the trackpoints `start..end` of the last track segment of the selection by the
/// given ones (a pure insertion when `start == end`, a pure removal when there are no new
/// points).
///
/// The selection can be made of several files, tracks or track segments: the indices are
/// meant for its very last segment, in file order, then track order, then segment order.
#[derive(Debug)]
pub struct SpliceTrackpoints<'a> {
    pub start: u32,
    pub end: u32,
    pub lng: &'a [f64],
    pub lat: &'a [f64],
    pub ele: &'a [f64],
}

impl Apply for SpliceTrackpoints<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let (start, end) = (self.start as usize, self.end as usize);
        if start > end || self.lng.len() != self.lat.len() || self.lat.len() != self.ele.len() {
            return Err(CommandError::InvalidData(
                "invalid trackpoints range".into(),
            ));
        }
        let (file_id, trk, seg) = last_segment(state).ok_or(CommandError::NothingToDo)?;
        let mut file = (*state.files[&file_id]).clone();
        let segment = &mut file.trk[trk].trkseg[seg];
        if end > segment.len() {
            return Err(CommandError::InvalidData(
                "trackpoints range out of bounds".into(),
            ));
        }
        if start == end && self.lng.is_empty() {
            return Err(CommandError::NothingToDo);
        }
        let points = (0..self.lng.len())
            .map(|i| Trackpoint {
                coordinates: LngLat {
                    lng: self.lng[i],
                    lat: self.lat[i],
                },
                ele: self.ele[i],
                ..Default::default()
            })
            .collect();
        segment.splice(start, end, points);
        segment.rev_id = Default::default();
        state.files.insert(file_id, Rc::new(file));
        Ok(())
    }
}

/// Position (file, track index, segment index) of the last segment of the selection.
fn last_segment(state: &State) -> Option<(FileId, usize, usize)> {
    let last_of_track = |file: &File, trk: usize| file.trk[trk].trkseg.len().checked_sub(1);
    let last_of_file = |file: &File, filter: &dyn Fn(usize) -> bool| {
        (0..file.trk.len())
            .rev()
            .filter(|&trk| filter(trk))
            .find_map(|trk| last_of_track(file, trk).map(|seg| (trk, seg)))
    };
    match &*state.selection {
        Selection::File { file_ids } => state
            .order
            .0
            .iter()
            .rev()
            .filter(|id| file_ids.contains(id))
            .find_map(|id| {
                let (trk, seg) = last_of_file(state.files.get(id)?, &|_| true)?;
                Some((*id, trk, seg))
            }),
        Selection::Track { file_id, trk_ids } => {
            let file = state.files.get(file_id)?;
            let (trk, seg) = last_of_file(file, &|trk| trk_ids.contains(&file.trk[trk].id))?;
            Some((*file_id, trk, seg))
        }
        Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            let file = state.files.get(file_id)?;
            let trk = file.trk.iter().position(|trk| trk.id == *trk_id)?;
            let seg = file.trk[trk]
                .trkseg
                .iter()
                .rposition(|seg| trkseg_ids.contains(&seg.id))?;
            Some((*file_id, trk, seg))
        }
        Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => None,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, engine::command::fixture::Fixture};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let id = fx.order.0[0];
        let trk = &fx.files[&id].trk[0];
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trk.trkseg[0].id]),
        };
        (fx, id)
    }

    fn splice<'a>(
        start: u32,
        end: u32,
        lng: &'a [f64],
        lat: &'a [f64],
        ele: &'a [f64],
    ) -> SpliceTrackpoints<'a> {
        SpliceTrackpoints {
            start,
            end,
            lng,
            lat,
            ele,
        }
    }

    #[test]
    fn test_splice_replaces_points_of_selected_segment_only() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let len = before.trk[0].trkseg[0].len();
        assert!(len >= 3);

        splice(1, 3, &[1.0, 2.0, 3.0], &[4.0, 5.0, 6.0], &[7.0, 8.0, 9.0])
            .apply(&mut fx.state())
            .unwrap();

        let after = &fx.files[&id];
        let (old, new) = (&before.trk[0].trkseg[0], &after.trk[0].trkseg[0]);
        assert_eq!(new.len(), len + 1);
        assert_eq!(new[0].coordinates.lng, old[0].coordinates.lng);
        assert_eq!(new[1].coordinates.lng, 1.0);
        assert_eq!(new[3].coordinates.lat, 6.0);
        assert_eq!(new[3].ele, 9.0);
        assert_eq!(new[4].coordinates.lng, old[3].coordinates.lng);
        assert_ne!(new.rev_id, old.rev_id);
        assert_eq!(new.id, old.id);
        // other segments and tracks keep their revision
        for (b, a) in before.trk.iter().zip(&after.trk) {
            for (b, a) in b.trkseg.iter().zip(&a.trkseg) {
                if a.id != new.id {
                    assert_eq!(a.rev_id, b.rev_id);
                }
            }
        }
    }

    #[test]
    fn test_splice_append_and_remove() {
        let (mut fx, id) = loaded();
        let len = fx.files[&id].trk[0].trkseg[0].len() as u32;
        splice(len, len, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        let seg = &fx.files[&id].trk[0].trkseg[0];
        assert_eq!(seg.len(), len as usize + 1);
        assert_eq!(seg[len as usize].ele, 3.0);

        splice(0, len + 1, &[], &[], &[])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(fx.files[&id].trk[0].trkseg[0].len(), 0);
    }

    #[test]
    fn test_splice_invalid_arguments_change_nothing() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let len = before.trk[0].trkseg[0].len() as u32;
        let results = [
            splice(2, 1, &[], &[], &[]).apply(&mut fx.state()),
            splice(0, 0, &[1.0], &[], &[]).apply(&mut fx.state()),
            splice(0, len + 1, &[], &[], &[]).apply(&mut fx.state()),
        ];
        assert!(
            results
                .iter()
                .all(|r| matches!(r, Err(CommandError::InvalidData(_))))
        );
        assert_eq!(
            splice(0, 0, &[], &[], &[]).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(std::rc::Rc::ptr_eq(&fx.files[&id], &before));
    }

    #[test]
    fn test_splice_needs_a_segment_selection() {
        let (mut fx, _) = loaded();
        fx.selection = Selection::Empty;
        assert_eq!(
            splice(0, 0, &[1.0], &[1.0], &[1.0]).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_splice_targets_last_segment_of_the_selection() {
        let (mut fx, id) = loaded();
        let file = fx.files[&id].clone();
        assert!(file.trk.len() >= 2);
        let last_trk = file.trk.len() - 1;
        let last_seg = file.trk[last_trk].trkseg.len() - 1;

        // whole file selected: last segment of its last track
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        splice(0, 0, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        let after = &fx.files[&id];
        for (t, (b, a)) in file.trk.iter().zip(&after.trk).enumerate() {
            for (s, (b, a)) in b.trkseg.iter().zip(&a.trkseg).enumerate() {
                let target = (t, s) == (last_trk, last_seg);
                assert_eq!(a.len(), b.len() + usize::from(target));
                assert_eq!(a.rev_id != b.rev_id, target);
            }
        }

        // several tracks selected: last selected one (in file order, whatever the set order)
        let ids: Vec<_> = file.trk.iter().map(|t| t.id).collect();
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([ids[1], ids[0]]),
        };
        let len = |fx: &Fixture, t: usize| {
            let trk = &fx.files[&id].trk[t];
            trk.trkseg.last().unwrap().len()
        };
        let (l0, l1) = (len(&fx, 0), len(&fx, 1));
        splice(0, 0, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(len(&fx, 0), l0);
        assert_eq!(len(&fx, 1), l1 + 1);

        // several segments selected
        let trk = &fx.files[&id].trk[0];
        let seg_ids: Vec<_> = trk.trkseg.iter().map(|s| s.id).collect();
        if seg_ids.len() >= 2 {
            fx.selection = Selection::TrackSegment {
                file_id: id,
                trk_id: trk.id,
                trkseg_ids: seg_ids.iter().copied().collect(),
            };
            let lens: Vec<_> = trk.trkseg.iter().map(|s| s.len()).collect();
            splice(0, 0, &[1.0], &[2.0], &[3.0])
                .apply(&mut fx.state())
                .unwrap();
            let after: Vec<_> = fx.files[&id].trk[0]
                .trkseg
                .iter()
                .map(|s| s.len())
                .collect();
            let n = lens.len();
            assert_eq!(after[..n - 1], lens[..n - 1]);
            assert_eq!(after[n - 1], lens[n - 1] + 1);
        }
    }

    #[test]
    fn test_splice_on_multiple_files_uses_last_in_file_order() {
        let (mut fx, first) = loaded();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let second = fx.order.0[1];
        fx.selection = Selection::File {
            file_ids: HashSet::from([second, first]),
        };
        let total = |fx: &Fixture, id: FileId| -> usize {
            fx.files[&id]
                .trk
                .iter()
                .flat_map(|t| &t.trkseg)
                .map(|s| s.len())
                .sum()
        };
        let (a, b) = (total(&fx, first), total(&fx, second));
        splice(0, 0, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(total(&fx, first), a);
        assert_eq!(total(&fx, second), b + 1);
    }
}
