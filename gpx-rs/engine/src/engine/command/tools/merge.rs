use std::{collections::HashSet, rc::Rc};

use crate::{
    Apply, CommandError, FileId, GlobalStatistics, Selection, State, Statistics, Track, TrackId,
    TrackSegment, TrackSegmentId, Waypoint, Waypoints, replace_trackpoints,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeType {
    /// The trackpoints of the elements are connected in a single segment.
    Connect,
    /// The elements are put together, in the first one, which keeps them as they are.
    Group,
}

/// Merges the selected elements into the first of them:
///
/// - files: the other files are deleted. The tracks of all of them are in the first file, as
///   they are with `Group`, or all connected in the first track with `Connect`. The waypoints of
///   all of them are in the first file too, except the ones that are the same.
/// - tracks of a file: the first track gets their segments, as they are with `Group`, or all
///   connected in one segment with `Connect`. The other tracks are removed.
/// - segments of a track: they are all connected in a segment at the position of the first one
///   with `Connect`. With `Group` they are put one after the other, at that position.
///
/// The segment made by `Connect` goes on in time, if there are timestamps, at the moving speed
/// of the selection, see [`replace_trackpoints`], which `remove_gaps` is given.
///
/// There is nothing to do when there is nothing to merge: a single file to group, a single track
/// that has no more than one segment, a single segment...
#[derive(Debug)]
pub struct Merge {
    pub type_: MergeType,
    pub remove_gaps: bool,
}

impl Apply for Merge {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let selection = state.selection.clone();
        match &selection {
            Selection::File { file_ids } => self.merge_files(state, file_ids),
            Selection::Track { file_id, trk_ids } => self.merge_tracks(state, *file_id, trk_ids),
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => self.merge_segments(state, *file_id, *trk_id, trkseg_ids),
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => {
                Err(CommandError::NothingToDo)
            }
        }
    }
}

impl Merge {
    fn merge_files(
        &self,
        state: &mut State,
        file_ids: &HashSet<FileId>,
    ) -> Result<(), CommandError> {
        // in the order of the files
        let ordered: Vec<FileId> = state
            .order
            .0
            .iter()
            .filter(|id| file_ids.contains(id))
            .chain(file_ids.iter().filter(|id| !state.order.0.contains(id)))
            .filter(|id| state.files.contains_key(id))
            .copied()
            .collect();
        let Some(&target_id) = ordered.first() else {
            return Err(CommandError::NothingToDo);
        };

        let mut tracks: Vec<Track> = vec![];
        let mut waypoints: Vec<Waypoint> = vec![];
        for id in &ordered {
            let file = &state.files[id];
            tracks.extend(file.trk.iter().cloned());
            for waypoint in file.wpt.iter() {
                if !waypoints.iter().any(|kept| kept.same_content(waypoint)) {
                    waypoints.push(waypoint.clone());
                }
            }
        }
        let segments: Vec<TrackSegment> = tracks
            .iter()
            .flat_map(|track| track.trkseg.iter().cloned())
            .collect();

        match self.type_ {
            MergeType::Group if ordered.len() == 1 => return Err(CommandError::NothingToDo),
            MergeType::Connect if ordered.len() == 1 && segments.len() <= 1 => {
                return Err(CommandError::NothingToDo);
            }
            MergeType::Connect if !segments.is_empty() => {
                // a single track, which is the first one, with the connected segment
                let merged = connect(&segments, segments[0].id, self.remove_gaps);
                let first = Track {
                    trkseg: vec![merged],
                    ..tracks[0].clone()
                };
                tracks = vec![first];
            }
            _ => {}
        }

        let mut target = (*state.files[&target_id]).clone();
        target.trk = tracks;
        target.wpt = Waypoints::default();
        target.wpt.insert_at(0, waypoints);
        for id in &ordered[1..] {
            state.files.remove(id);
        }
        state.order.0.retain(|id| !ordered[1..].contains(id));
        state.files.insert(target_id, Rc::new(target));
        Ok(())
    }

    fn merge_tracks(
        &self,
        state: &mut State,
        file_id: FileId,
        trk_ids: &HashSet<TrackId>,
    ) -> Result<(), CommandError> {
        let file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
        let selected: Vec<usize> = (0..file.trk.len())
            .filter(|i| trk_ids.contains(&file.trk[*i].id))
            .collect();
        let Some(&first) = selected.first() else {
            return Err(CommandError::NothingToDo);
        };
        let segments: Vec<TrackSegment> = selected
            .iter()
            .flat_map(|i| file.trk[*i].trkseg.iter().cloned())
            .collect();
        if selected.len() == 1 && (self.type_ == MergeType::Group || segments.len() <= 1) {
            return Err(CommandError::NothingToDo);
        }

        let merged = match self.type_ {
            MergeType::Group => segments,
            MergeType::Connect if segments.is_empty() => vec![],
            MergeType::Connect => {
                vec![connect(&segments, segments[0].id, self.remove_gaps)]
            }
        };
        let mut file = (**file).clone();
        file.trk[first].trkseg = merged;
        let mut index = 0;
        file.trk.retain(|_| {
            index += 1;
            !selected[1..].contains(&(index - 1))
        });
        state.files.insert(file_id, Rc::new(file));
        Ok(())
    }

    fn merge_segments(
        &self,
        state: &mut State,
        file_id: FileId,
        trk_id: TrackId,
        ids: &HashSet<TrackSegmentId>,
    ) -> Result<(), CommandError> {
        let file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
        let trk = file
            .trk
            .iter()
            .position(|trk| trk.id == trk_id)
            .ok_or(CommandError::NothingToDo)?;
        let segments = &file.trk[trk].trkseg;
        let selected: Vec<usize> = (0..segments.len())
            .filter(|i| ids.contains(&segments[*i].id))
            .collect();
        if selected.len() < 2 {
            return Err(CommandError::NothingToDo);
        }
        let first = selected[0];
        let chosen: Vec<TrackSegment> = selected.iter().map(|i| segments[*i].clone()).collect();
        let merged = match self.type_ {
            MergeType::Connect => vec![connect(&chosen, chosen[0].id, self.remove_gaps)],
            MergeType::Group => {
                if selected.iter().enumerate().all(|(i, s)| *s == first + i) {
                    // already one after the other
                    return Err(CommandError::NothingToDo);
                }
                chosen
            }
        };

        let mut file = (**file).clone();
        let mut remaining: Vec<TrackSegment> = file.trk[trk]
            .trkseg
            .iter()
            .filter(|segment| !ids.contains(&segment.id))
            .cloned()
            .collect();
        // the ones before the first selected one are all kept
        remaining.splice(first..first, merged);
        file.trk[trk].trkseg = remaining;
        state.files.insert(file_id, Rc::new(file));
        Ok(())
    }
}

/// The segments connected in a single one, which has the id `id`: the trackpoints of the second
/// go after the ones of the first and so on.
///
/// If there are timestamps, the new segment goes on in time, see [`replace_trackpoints`]: the
/// trackpoints that have none get some, at the moving speed of the segments, and the ones that
/// are too early follow the previous ones. The time of the first trackpoint is the one it has, or
/// the one it would have if it was as far in time from the first timed one as its distance
/// says.
fn connect(segments: &[TrackSegment], id: TrackSegmentId, remove_gaps: bool) -> TrackSegment {
    let mut global = GlobalStatistics::default();
    let mut distance = 0.0;
    // the first time, and the distance from the start at which it is
    let mut first_timed: Option<(i64, f64)> = None;
    for segment in segments {
        let stats = Statistics::compute(segment);
        if first_timed.is_none() {
            first_timed = segment.iter().zip(&stats.local).find_map(|(point, local)| {
                point
                    .time
                    .map(|time| (time, distance + local.total_distance))
            });
        }
        distance += stats.global.total_distance;
        global.merge(&stats.global);
    }
    let speed = global.moving_speed().filter(|speed| *speed > 0.0);
    let start_time = speed
        .and_then(|speed| first_timed.map(|(time, km)| time - (3_600_000.0 * km / speed) as i64));

    let mut points = vec![];
    for segment in segments {
        let end = points.len();
        replace_trackpoints(
            &mut points,
            end,
            end,
            segment.iter().cloned().collect(),
            speed,
            start_time,
            remove_gaps,
        );
    }
    let mut merged = TrackSegment::default();
    merged.splice(0, 0, points);
    merged.id = id;
    merged
}

#[cfg(test)]
mod tests {
    use crate::{File, Load, engine::command::fixture::Fixture};

    use super::*;

    fn load(fx: &mut Fixture, path: &str) -> FileId {
        let data = std::fs::read(path).unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        *fx.order.0.last().unwrap()
    }

    fn merge(type_: MergeType) -> Merge {
        Merge {
            type_,
            remove_gaps: false,
        }
    }

    fn select_files(fx: &mut Fixture, ids: &[FileId]) {
        fx.selection = Selection::File {
            file_ids: ids.iter().copied().collect(),
        };
    }

    fn points(file: &File) -> usize {
        file.trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .map(|s| s.len())
            .sum()
    }

    fn waypoint(name: &str) -> Waypoint {
        Waypoint {
            name: Some(name.into()),
            ..Default::default()
        }
    }

    #[test]
    fn test_group_files() {
        let mut fx = Fixture::default();
        let a = load(&mut fx, "data/with_tracks_and_segments.gpx");
        let b = load(&mut fx, "data/simple.gpx");
        let mut file_a = (*fx.files[&a]).clone();
        file_a
            .wpt
            .insert_at(0, vec![waypoint("x"), waypoint("same")]);
        fx.files.insert(a, Rc::new(file_a));
        let mut file_b = (*fx.files[&b]).clone();
        file_b
            .wpt
            .insert_at(0, vec![waypoint("same"), waypoint("y")]);
        fx.files.insert(b, Rc::new(file_b));
        let (before_a, before_b) = (fx.files[&a].clone(), fx.files[&b].clone());
        select_files(&mut fx, &[b, a]);

        merge(MergeType::Group).apply(&mut fx.state()).unwrap();

        // the first file (in the order of the files) gets everything, the other one goes
        assert_eq!(fx.order.0, [a]);
        assert!(!fx.files.contains_key(&b));
        let merged = &fx.files[&a];
        assert_eq!(merged.trk.len(), before_a.trk.len() + before_b.trk.len());
        assert_eq!(merged.trk[0].id, before_a.trk[0].id);
        assert_eq!(
            merged.trk.last().unwrap().id,
            before_b.trk.last().unwrap().id
        );
        assert_eq!(points(merged), points(&before_a) + points(&before_b));
        // the waypoints that are the same are only once
        let names: Vec<_> = merged.wpt.iter().map(|w| w.name.clone().unwrap()).collect();
        assert_eq!(names, ["x", "same", "y"]);
        assert_eq!(merged.info, before_a.info);
        // a single file has nothing to group
        select_files(&mut fx, &[a]);
        assert_eq!(
            merge(MergeType::Group).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_connect_files() {
        let mut fx = Fixture::default();
        let a = load(&mut fx, "data/with_tracks_and_segments.gpx");
        let b = load(&mut fx, "data/simple.gpx");
        let (before_a, before_b) = (fx.files[&a].clone(), fx.files[&b].clone());
        select_files(&mut fx, &[a, b]);

        merge(MergeType::Connect).apply(&mut fx.state()).unwrap();

        let merged = &fx.files[&a];
        assert_eq!(fx.order.0, [a]);
        // a single track, with a single segment that has all the trackpoints in order
        assert_eq!(merged.trk.len(), 1);
        assert_eq!(merged.trk[0].id, before_a.trk[0].id);
        assert_eq!(merged.trk[0].trkseg.len(), 1);
        let segment = &merged.trk[0].trkseg[0];
        assert_eq!(segment.len(), points(&before_a) + points(&before_b));
        let expected: Vec<f64> = before_a
            .trk
            .iter()
            .chain(&before_b.trk)
            .flat_map(|t| &t.trkseg)
            .flat_map(|s| s.iter().map(|p| p.coordinates.lng))
            .collect();
        let lngs: Vec<f64> = segment.iter().map(|p| p.coordinates.lng).collect();
        assert_eq!(lngs, expected);
        assert_eq!(segment.id, before_a.trk[0].trkseg[0].id);
        assert_eq!(segment[0].anchor, Some(0));
    }

    #[test]
    fn test_connect_goes_on_in_time() {
        let mut fx = Fixture::default();
        // the same times twice: the second part would be too early
        let a = load(&mut fx, "data/with_time.gpx");
        let b = load(&mut fx, "data/with_time.gpx");
        select_files(&mut fx, &[a, b]);
        merge(MergeType::Connect).apply(&mut fx.state()).unwrap();
        let segment = &fx.files[&a].trk[0].trkseg[0];
        let times: Vec<i64> = segment.iter().map(|p| p.time.unwrap()).collect();
        assert_eq!(times.len(), 160);
        assert!(times.windows(2).all(|w| w[0] <= w[1]), "{times:?}");
        assert!(times[80] > times[79]);
    }

    #[test]
    fn test_connect_without_gaps_brings_the_parts_closer() {
        let mut fx = Fixture::default();
        let a = load(&mut fx, "data/with_time.gpx");
        // the second file comes a day later
        let b = {
            let data = std::fs::read("data/with_time.gpx").unwrap();
            Load {
                data: &data,
                name: "late",
            }
            .apply(&mut fx.state())
            .unwrap();
            *fx.order.0.last().unwrap()
        };
        let mut file = (*fx.files[&b]).clone();
        for track in file.trk.iter_mut() {
            for segment in track.trkseg.iter_mut() {
                let points: Vec<_> = segment
                    .iter()
                    .map(|p| {
                        let mut p = p.clone();
                        p.time = p.time.map(|t| t + 86_400_000);
                        p
                    })
                    .collect();
                let len = segment.len();
                segment.splice(0, len, points);
            }
        }
        fx.files.insert(b, Rc::new(file));
        let gap = |fx: &Fixture, remove_gaps: bool| {
            let mut fx2 = Fixture {
                files: fx.files.clone(),
                order: crate::FileOrder(fx.order.0.clone()),
                selection: Selection::File {
                    file_ids: [a, b].into(),
                },
                ..Default::default()
            };
            Merge {
                type_: MergeType::Connect,
                remove_gaps,
            }
            .apply(&mut fx2.state())
            .unwrap();
            let segment = &fx2.files[&a].trk[0].trkseg[0];
            segment[80].time.unwrap() - segment[79].time.unwrap()
        };
        let with_gap = gap(&fx, false);
        let without = gap(&fx, true);
        assert!(with_gap > 80_000_000, "{with_gap}");
        assert!(without < 60_000, "{without}");
    }

    #[test]
    fn test_merge_tracks() {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        assert!(file.trk.len() >= 2);
        let ids: HashSet<TrackId> = file.trk.iter().map(|t| t.id).collect();
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: ids,
        };
        let segments: usize = file.trk.iter().map(|t| t.trkseg.len()).sum();

        merge(MergeType::Group).apply(&mut fx.state()).unwrap();
        let merged = &fx.files[&id];
        assert_eq!(merged.trk.len(), 1);
        assert_eq!(merged.trk[0].id, file.trk[0].id);
        assert_eq!(merged.trk[0].trkseg.len(), segments);
        assert_eq!(points(merged), points(&file));

        // connected: a single segment
        fx.files.insert(id, file.clone());
        merge(MergeType::Connect).apply(&mut fx.state()).unwrap();
        let merged = &fx.files[&id];
        assert_eq!(merged.trk.len(), 1);
        assert_eq!(merged.trk[0].trkseg.len(), 1);
        assert_eq!(merged.trk[0].trkseg[0].len(), points(&file));

        // one track with a single segment: nothing to do
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [file.trk[0].id].into(),
        };
        for type_ in [MergeType::Group, MergeType::Connect] {
            assert_eq!(
                merge(type_).apply(&mut fx.state()),
                Err(CommandError::NothingToDo)
            );
        }
    }

    #[test]
    fn test_connect_the_segments_of_a_track() {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/with_tracks_and_segments.gpx");
        let file = fx.files[&id].clone();
        let (index, track) = file
            .trk
            .iter()
            .enumerate()
            .find(|(_, t)| t.trkseg.len() >= 2)
            .unwrap();
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [track.id].into(),
        };
        merge(MergeType::Connect).apply(&mut fx.state()).unwrap();
        let merged = &fx.files[&id].trk[index];
        assert_eq!(merged.id, track.id);
        assert_eq!(merged.trkseg.len(), 1);
        assert_eq!(
            merged.trkseg[0].len(),
            track.trkseg.iter().map(|s| s.len()).sum::<usize>()
        );
        // the other tracks are untouched
        assert_eq!(fx.files[&id].trk.len(), file.trk.len());
    }

    #[test]
    fn test_merge_segments() {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/with_tracks_and_segments.gpx");
        // a track with three segments
        let mut three = (*fx.files[&id]).clone();
        let base = three.trk[0].trkseg[0].clone();
        three.trk[0].trkseg = (0..3).map(|_| crate::copy_segment(&base)).collect();
        fx.files.insert(id, Rc::new(three));
        let file = fx.files[&id].clone();
        let (index, track) = (0, &file.trk[0]);
        let segments = &track.trkseg;
        // the first and the last ones
        let (first, last) = (&segments[0], &segments[2]);
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: [first.id, last.id].into(),
        };

        // grouped: next to each other, at the place of the first one
        merge(MergeType::Group).apply(&mut fx.state()).unwrap();
        let ids: Vec<_> = fx.files[&id].trk[index]
            .trkseg
            .iter()
            .map(|s| s.id)
            .collect();
        assert_eq!(ids[..3], [first.id, last.id, segments[1].id]);

        // connected: one segment, with the id of the first one, at its place
        fx.files.insert(id, file.clone());
        merge(MergeType::Connect).apply(&mut fx.state()).unwrap();
        let merged = &fx.files[&id].trk[index].trkseg;
        assert_eq!(merged.len(), segments.len() - 1);
        assert_eq!(merged[0].id, first.id);
        assert_eq!(merged[0].len(), first.len() + last.len());
        assert_eq!(merged[1].id, segments[1].id);

        // a single segment, or segments that are already together: nothing to do
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: [first.id].into(),
        };
        assert_eq!(
            merge(MergeType::Connect).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.files.insert(id, file.clone());
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: [first.id, segments[1].id].into(),
        };
        assert_eq!(
            merge(MergeType::Group).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_nothing_to_merge() {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/simple.gpx");
        let before = fx.files[&id].clone();
        for selection in [Selection::Empty, Selection::Waypoints { file_id: id }] {
            fx.selection = selection;
            assert_eq!(
                merge(MergeType::Connect).apply(&mut fx.state()),
                Err(CommandError::NothingToDo)
            );
        }
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
