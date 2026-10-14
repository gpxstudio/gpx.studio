use std::rc::Rc;

use crate::{
    Apply, CommandError, File, FileId, Selection, State, TrackId, TrackSegmentId, end_time,
    reverse_segment, reverse_segments, reverse_tracks, start_time, track_end_time,
    track_start_time,
};

/// Reverses the direction of the selected elements: the whole of each selected file (its tracks,
/// the segments of its tracks and their trackpoints are in the opposite order), of each selected
/// track (its segments and their trackpoints), or each selected segment on its own (its
/// trackpoints). The timestamps are mirrored, see [`reverse_segment`].
#[derive(Debug)]
pub struct Reverse;

impl Apply for Reverse {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let locations = state
            .selection
            .segment_locations(state.files, &state.order.0);
        let points: usize = locations
            .iter()
            .map(|location| {
                state.files[&location.file_id].trk[location.trk].trkseg[location.seg].len()
            })
            .sum();
        if points <= 1 {
            return Err(CommandError::NothingToDo);
        }

        let mut files: Vec<(FileId, File)> = vec![];
        let mut edit = |file_id: &FileId, f: &dyn Fn(&mut File)| {
            if let Some(file) = state.files.get(file_id) {
                let mut file = (**file).clone();
                f(&mut file);
                files.push((*file_id, file));
            }
        };
        match &*state.selection {
            Selection::File { file_ids } => {
                for file_id in file_ids {
                    edit(file_id, &|file| {
                        let end = file.trk.last().and_then(track_end_time);
                        let start = file.trk.first().and_then(track_start_time);
                        reverse_tracks(&mut file.trk, end, start);
                    });
                }
            }
            Selection::Track { file_id, trk_ids } => edit(file_id, &|file| {
                reverse_selected_tracks(file, trk_ids);
            }),
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => edit(file_id, &|file| {
                reverse_selected_segments(file, *trk_id, trkseg_ids);
            }),
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => {}
        }

        for (file_id, file) in files {
            state.files.insert(file_id, Rc::new(file));
        }
        Ok(())
    }
}

fn reverse_selected_tracks(file: &mut File, ids: &std::collections::HashSet<TrackId>) {
    for track in file.trk.iter_mut().filter(|track| ids.contains(&track.id)) {
        let end = track.trkseg.last().and_then(end_time);
        let start = track.trkseg.first().and_then(start_time);
        reverse_segments(&mut track.trkseg, end, start);
    }
}

fn reverse_selected_segments(
    file: &mut File,
    track_id: TrackId,
    ids: &std::collections::HashSet<TrackSegmentId>,
) {
    for track in file.trk.iter_mut().filter(|track| track.id == track_id) {
        for segment in track
            .trkseg
            .iter_mut()
            .filter(|segment| ids.contains(&segment.id))
        {
            let (end, start) = (end_time(segment), start_time(segment));
            reverse_segment(segment, end, start);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{Load, TrackSegment, engine::command::fixture::Fixture};

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

    fn all_segments(fx: &Fixture, id: FileId) -> Vec<TrackSegment> {
        fx.files[&id]
            .trk
            .iter()
            .flat_map(|track| track.trkseg.iter().cloned())
            .collect()
    }

    fn lngs(segment: &TrackSegment) -> Vec<f64> {
        segment.iter().map(|p| p.coordinates.lng).collect()
    }

    #[test]
    fn test_reversing_a_file_reverses_tracks_segments_and_points() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let before = all_segments(&fx, id);
        assert!(before.len() >= 3);
        let (tracks_before, ids_before): (Vec<usize>, Vec<_>) = (
            fx.files[&id].trk.iter().map(|t| t.trkseg.len()).collect(),
            fx.files[&id].trk.iter().map(|t| t.id).collect(),
        );

        Reverse.apply(&mut fx.state()).unwrap();

        let after = all_segments(&fx, id);
        assert_eq!(after.len(), before.len());
        // the whole path is the opposite one
        let path =
            |segments: &[TrackSegment]| -> Vec<f64> { segments.iter().flat_map(lngs).collect() };
        let mut expected = path(&before);
        expected.reverse();
        assert_eq!(path(&after), expected);
        // the tracks are in the opposite order, each with the same number of segments
        let tracks_after: Vec<usize> = fx.files[&id].trk.iter().map(|t| t.trkseg.len()).collect();
        let mut reversed = tracks_before.clone();
        reversed.reverse();
        assert_eq!(tracks_after, reversed);
        let ids_after: Vec<_> = fx.files[&id].trk.iter().map(|t| t.id).collect();
        let mut reversed_ids = ids_before;
        reversed_ids.reverse();
        assert_eq!(ids_after, reversed_ids);
        // the segments changed, and they still end where they should
        assert!(after.iter().all(|s| s.rev_id != before[0].rev_id));
        for segment in &after {
            assert_eq!(segment[0].anchor, Some(0));
            assert_eq!(segment[segment.len() - 1].anchor, Some(0));
        }
    }

    #[test]
    fn test_reversing_a_file_twice_gives_the_same_path_and_times() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let before = all_segments(&fx, id);
        let times = |segments: &[TrackSegment]| -> Vec<Option<i64>> {
            segments
                .iter()
                .flat_map(|s| s.iter().map(|p| p.time))
                .collect()
        };
        Reverse.apply(&mut fx.state()).unwrap();
        Reverse.apply(&mut fx.state()).unwrap();
        let after = all_segments(&fx, id);
        for (a, b) in before.iter().zip(&after) {
            assert_eq!(lngs(a), lngs(b));
            assert_eq!(a.id, b.id);
        }
        assert_eq!(times(&before), times(&after));
    }

    #[test]
    fn test_reversing_segments_keeps_the_others() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let trk = &file.trk[0];
        assert!(trk.trkseg.len() >= 2);
        let target = &trk.trkseg[1];
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([target.id]),
        };
        Reverse.apply(&mut fx.state()).unwrap();

        let after = &fx.files[&id].trk[0];
        // the segment is reversed in place
        let mut expected = lngs(target);
        expected.reverse();
        assert_eq!(lngs(&after.trkseg[1]), expected);
        assert_eq!(after.trkseg[1].id, target.id);
        assert_ne!(after.trkseg[1].rev_id, target.rev_id);
        // the other ones are the same
        for (i, segment) in trk.trkseg.iter().enumerate().filter(|(i, _)| *i != 1) {
            assert_eq!(after.trkseg[i].rev_id, segment.rev_id, "{i}");
        }
        assert_eq!(fx.files[&id].trk.len(), file.trk.len());
    }

    #[test]
    fn test_reversing_tracks_reverses_their_segments_in_place() {
        let (mut fx, id) = loaded("data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let (index, trk) = file
            .trk
            .iter()
            .enumerate()
            .find(|(_, t)| t.trkseg.len() >= 2)
            .unwrap();
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([trk.id]),
        };
        Reverse.apply(&mut fx.state()).unwrap();

        let after = &fx.files[&id];
        // the track stays where it is, its segments are the opposite way
        assert_eq!(after.trk[index].id, trk.id);
        let path = |t: &crate::Track| -> Vec<f64> { t.trkseg.iter().flat_map(lngs).collect() };
        let mut expected = path(trk);
        expected.reverse();
        assert_eq!(path(&after.trk[index]), expected);
        // and the other tracks do not change
        for (i, other) in file.trk.iter().enumerate().filter(|(i, _)| *i != index) {
            assert_eq!(path(&after.trk[i]), path(other));
        }
    }

    #[test]
    fn test_times_are_mirrored() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = all_segments(&fx, id).remove(0);
        Reverse.apply(&mut fx.state()).unwrap();
        let after = all_segments(&fx, id).remove(0);
        let (start, end) = (start_time(&before).unwrap(), end_time(&before).unwrap());
        // the same period of time, the first point of the new path is the last one
        assert_eq!(start_time(&after), Some(start));
        assert_eq!(end_time(&after), Some(end));
        let n = before.len();
        for i in 0..n {
            assert_eq!(
                after[i].time.unwrap(),
                start + end - before[n - 1 - i].time.unwrap()
            );
            assert_eq!(after[i].coordinates.lng, before[n - 1 - i].coordinates.lng);
        }
    }

    #[test]
    fn test_nothing_to_reverse() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = fx.files[&id].clone();
        fx.selection = Selection::Empty;
        assert_eq!(
            Reverse.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.selection = Selection::Waypoints { file_id: id };
        assert_eq!(
            Reverse.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(Rc::ptr_eq(&fx.files[&id], &before));

        // a single trackpoint has no direction
        let mut file = (*fx.files[&id]).clone();
        let segment = &mut file.trk[0].trkseg[0];
        let len = segment.len();
        segment.splice(1, len, vec![]);
        fx.files.insert(id, Rc::new(file));
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        assert_eq!(
            Reverse.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
}
