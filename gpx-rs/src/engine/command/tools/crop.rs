use std::{
    collections::{HashMap, HashSet},
    rc::Rc,
};

use crate::{
    Apply, CommandError, File, FileId, SegmentLocation, Selection, State, TrackSegment,
    TrackSegmentId,
};

/// Keeps the trackpoints `start` to `end` (both included) of the selection, which are counted
/// over its segments one after the other (as in the `RoutingBuffer`), and removes the others.
///
/// The segments that have no trackpoint left are removed. So are the tracks that have no segment
/// left, if tracks or files are selected (not if only segments are), and the files that have no
/// trackpoint left, if files are selected. A range that goes past the last trackpoint stops at it.
#[derive(Debug)]
pub struct Crop {
    pub start: u32,
    pub end: u32,
}

/// What happens to a selected segment.
struct Plan {
    location: SegmentLocation,
    /// The trackpoints that are kept, `None` if the segment goes away.
    keep: Option<(usize, usize)>,
    len: usize,
}

impl Apply for Crop {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let (start, end) = (self.start as usize, self.end as usize);
        if start > end {
            return Err(CommandError::InvalidData(
                "invalid trackpoints range".into(),
            ));
        }

        let mut offset = 0;
        let plans: Vec<Plan> = state
            .selection
            .segment_locations(state.files, &state.order.0)
            .into_iter()
            .map(|location| {
                let len =
                    state.files[&location.file_id].trk[location.trk].trkseg[location.seg].len();
                let keep = (len > 0 && start < offset + len && end >= offset)
                    .then(|| (start.saturating_sub(offset), (end - offset).min(len - 1)));
                offset += len;
                Plan {
                    location,
                    keep,
                    len,
                }
            })
            .collect();
        if plans
            .iter()
            .all(|plan| plan.keep == Some((0, plan.len.saturating_sub(1))))
        {
            // everything is kept as it is, or there is nothing
            return Err(CommandError::NothingToDo);
        }

        // the files and tracks to prune, the segments to remove
        let (prune_tracks, prune_files) = match &*state.selection {
            Selection::File { .. } => (true, true),
            Selection::Track { .. } => (true, false),
            _ => (false, false),
        };
        let mut files: HashMap<FileId, File> = HashMap::new();
        let mut removed: HashSet<TrackSegmentId> = HashSet::new();
        let mut had_points: HashSet<FileId> = HashSet::new();
        for plan in &plans {
            let SegmentLocation { file_id, trk, seg } = plan.location;
            let file = files
                .entry(file_id)
                .or_insert_with(|| (*state.files[&file_id]).clone());
            if plan.len > 0 {
                had_points.insert(file_id);
            }
            let segment = &mut file.trk[trk].trkseg[seg];
            match plan.keep {
                None => {
                    removed.insert(segment.id);
                }
                Some((from, to)) => crop_segment(segment, from, to),
            }
        }

        let mut gone: Vec<FileId> = vec![];
        for (file_id, file) in files.iter_mut() {
            // the tracks that lost segments
            let touched: Vec<bool> = file
                .trk
                .iter_mut()
                .map(|track| {
                    let before = track.trkseg.len();
                    track
                        .trkseg
                        .retain(|segment| !removed.contains(&segment.id));
                    before != track.trkseg.len()
                })
                .collect();
            if prune_tracks {
                let mut touched = touched.into_iter();
                file.trk
                    .retain(|track| !(touched.next().unwrap() && track.trkseg.is_empty()));
            }
            if prune_files && file.trk.is_empty() && had_points.contains(file_id) {
                gone.push(*file_id);
            }
        }

        for (file_id, file) in files {
            if gone.contains(&file_id) {
                state.files.remove(&file_id);
                state.order.0.retain(|id| *id != file_id);
            } else {
                state.files.insert(file_id, Rc::new(file));
            }
        }
        Ok(())
    }
}

/// Keeps the trackpoints `from` to `to` of a segment, which are in it. Only the chunks at the ends
/// are changed.
fn crop_segment(segment: &mut TrackSegment, from: usize, to: usize) {
    let len = segment.len();
    if from == 0 && to + 1 >= len {
        return;
    }
    segment.splice(to + 1, len, vec![]);
    segment.splice(0, from, vec![]);
    segment.rev_id = Default::default();
}

#[cfg(test)]
mod tests {
    use crate::{Load, engine::command::fixture::Fixture};

    use super::*;

    fn loaded(path: &str) -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read(path).unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = fx.order.0[0];
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        (fx, id)
    }

    fn crop(start: u32, end: u32) -> Crop {
        Crop { start, end }
    }

    /// The longitudes of the trackpoints of a file, one list per segment.
    fn paths(file: &File) -> Vec<Vec<f64>> {
        file.trk
            .iter()
            .flat_map(|track| &track.trkseg)
            .map(|segment| segment.iter().map(|p| p.coordinates.lng).collect())
            .collect()
    }

    #[test]
    fn test_crop_a_file_keeps_the_range_over_its_segments() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let before = paths(&fx.files[&id]);
        let flat: Vec<f64> = before.iter().flatten().copied().collect();
        let (start, end) = (2, flat.len() - 3);

        crop(start as u32, end as u32)
            .apply(&mut fx.state())
            .unwrap();

        let after: Vec<f64> = paths(&fx.files[&id]).iter().flatten().copied().collect();
        assert_eq!(after, flat[start..=end]);
        // the ends of the segments that are left are anchors
        for track in &fx.files[&id].trk {
            for segment in &track.trkseg {
                assert!(!segment.is_empty());
                assert_eq!(segment[0].anchor, Some(0));
                assert_eq!(segment[segment.len() - 1].anchor, Some(0));
            }
        }
    }

    #[test]
    fn test_what_is_outside_goes_away() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let lens: Vec<Vec<usize>> = file
            .trk
            .iter()
            .map(|t| t.trkseg.iter().map(|segment| segment.len()).collect())
            .collect();
        assert!(lens.len() >= 2);
        // from the start of the last track to the end
        let before_last: usize = lens[..lens.len() - 1].iter().flatten().sum();
        crop(before_last as u32, u32::MAX)
            .apply(&mut fx.state())
            .unwrap();

        let after = &fx.files[&id];
        // the other tracks are gone, the last one is whole
        assert_eq!(after.trk.len(), 1);
        assert_eq!(after.trk[0].id, file.trk.last().unwrap().id);
        assert_eq!(
            after.trk[0]
                .trkseg
                .iter()
                .map(|segment| segment.len())
                .collect::<Vec<_>>(),
            *lens.last().unwrap()
        );
        // the selection followed
        assert!(matches!(&fx.selection, Selection::File { .. }));
    }

    #[test]
    fn test_crop_inside_a_segment_changes_it_only() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let trk = &file.trk[0];
        assert!(trk.trkseg.len() >= 2);
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trk.trkseg[1].id]),
        };
        let len = trk.trkseg[1].len();
        assert!(len > 4);
        crop(1, len as u32 - 2).apply(&mut fx.state()).unwrap();

        let after = &fx.files[&id].trk[0];
        assert_eq!(after.trkseg[1].len(), len - 2);
        assert_ne!(after.trkseg[1].rev_id, trk.trkseg[1].rev_id);
        // the other segments are not in the selection, whatever the range
        assert_eq!(after.trkseg[0].rev_id, trk.trkseg[0].rev_id);
        assert_eq!(fx.files[&id].trk.len(), file.trk.len());
    }

    #[test]
    fn test_segments_out_of_the_range_are_removed_but_not_their_track() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let trk = fx.files[&id].trk[0].clone();
        assert!(trk.trkseg.len() >= 2);
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: trk.trkseg.iter().map(|s| s.id).collect(),
        };
        // only the first segment, entirely
        let first = trk.trkseg[0].len();
        crop(0, first as u32 - 1).apply(&mut fx.state()).unwrap();
        let after = &fx.files[&id].trk[0];
        assert_eq!(after.trkseg.len(), 1);
        assert_eq!(after.trkseg[0].id, trk.trkseg[0].id);

        // nothing at all: the segments go, the track stays
        crop(100_000, 100_001).apply(&mut fx.state()).unwrap();
        assert!(fx.files[&id].trk[0].trkseg.is_empty());
    }

    #[test]
    fn test_files_out_of_the_range_are_deleted() {
        let (mut fx, first) = loaded("data/simple.gpx");
        let data = std::fs::read("data/with_time.gpx").unwrap();
        Load {
            data: &data,
            name: "second",
        }
        .apply(&mut fx.state())
        .unwrap();
        let second = fx.order.0[1];
        fx.selection = Selection::File {
            file_ids: HashSet::from([first, second]),
        };
        let first_len: usize = fx.files[&first]
            .trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .map(|segment| segment.len())
            .sum();

        crop(first_len as u32 + 1, u32::MAX)
            .apply(&mut fx.state())
            .unwrap();
        assert!(!fx.files.contains_key(&first));
        assert_eq!(fx.order.0, [second]);
        let kept: usize = fx.files[&second]
            .trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .map(|segment| segment.len())
            .sum();
        assert!(kept > 0);
    }

    #[test]
    fn test_nothing_to_do_or_invalid() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = fx.files[&id].clone();
        // the whole selection
        assert_eq!(
            crop(0, u32::MAX).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(matches!(
            crop(5, 2).apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        fx.selection = Selection::Empty;
        assert_eq!(
            crop(0, 3).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.selection = Selection::Waypoints { file_id: id };
        assert_eq!(
            crop(0, 3).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
