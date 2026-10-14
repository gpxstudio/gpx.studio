use std::{collections::HashSet, rc::Rc};

use crate::{
    Apply, CommandError, File, FileId, LngLat, LngLatBounds, Selection, State, Track, TrackId,
    TrackSegment, Waypoint, Waypoints, copy_waypoint, crossarc_lnglat, distance,
};

/// Splits the selected elements that are made of several segments into elements that have one
/// each:
///
/// - files: a file with several tracks becomes one file per track, in which the track is split
///   into one track per segment. A file with a single track becomes one file per segment. The new
///   files are in the place of the file, which goes, and are selected. They are named after the
///   track, or the file, and numbered. The waypoints go to the files that have the segments
///   closest to them (to the first file if the file has no trackpoint).
/// - tracks: each selected track is replaced by one track per segment, which are selected. They
///   are named after the track and numbered.
///
/// What has a single segment is left as it is. There is nothing to do if nothing was changed.
#[derive(Debug)]
pub struct Extract;

impl Apply for Extract {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let selection = state.selection.clone();
        match &selection {
            Selection::File { file_ids } => extract_files(state, file_ids),
            Selection::Track { file_id, trk_ids } => extract_tracks(state, *file_id, trk_ids),
            _ => Err(CommandError::NothingToDo),
        }
    }
}

fn extract_files(state: &mut State, file_ids: &HashSet<FileId>) -> Result<(), CommandError> {
    // the files that have something to extract, with the files that come out of them
    let mut extracted: Vec<(FileId, Vec<File>)> = vec![];
    for id in state.order.0.iter().filter(|id| file_ids.contains(id)) {
        let file = &state.files[id];
        let segments: usize = file.trk.iter().map(|track| track.trkseg.len()).sum();
        if segments > 1 {
            extracted.push((*id, extract_file(file)));
        }
    }
    if extracted.is_empty() {
        return Err(CommandError::NothingToDo);
    }

    let mut order = vec![];
    for id in state.order.0.iter() {
        match extracted.iter().find(|(original, _)| original == id) {
            Some((_, files)) => order.extend(files.iter().map(|file| file.id)),
            None => order.push(*id),
        }
    }
    let mut selected: HashSet<FileId> = file_ids.clone();
    for (original, files) in extracted {
        state.files.remove(&original);
        selected.remove(&original);
        for file in files {
            selected.insert(file.id);
            state.files.insert(file.id, Rc::new(file));
        }
    }
    state.order.0 = order;
    *state.selection = Selection::File { file_ids: selected };
    Ok(())
}

/// The files that a file with several segments becomes.
fn extract_file(file: &File) -> Vec<File> {
    // for each new file: its tracks and its name, and the segments that go with it
    struct Part {
        tracks: Vec<Track>,
        name: String,
    }
    let (parts, owner): (Vec<Part>, Vec<usize>) = if file.trk.len() > 1 {
        // one file per track, the segments of a track follow it
        let parts = file
            .trk
            .iter()
            .enumerate()
            .map(|(i, track)| Part {
                tracks: split_track(track),
                name: track
                    .info
                    .name
                    .clone()
                    .unwrap_or_else(|| format!("{} ({})", file.info.name, i + 1)),
            })
            .collect();
        let owner = file
            .trk
            .iter()
            .enumerate()
            .flat_map(|(i, track)| track.trkseg.iter().map(move |_| i))
            .collect();
        (parts, owner)
    } else {
        // one file per segment
        let track = &file.trk[0];
        let base = track
            .info
            .name
            .clone()
            .unwrap_or_else(|| file.info.name.clone());
        let parts = track
            .trkseg
            .iter()
            .enumerate()
            .map(|(i, segment)| Part {
                tracks: vec![Track {
                    id: if i == 0 { track.id } else { Default::default() },
                    trkseg: vec![segment.clone()],
                    ..track.clone()
                }],
                name: format!("{base} ({})", i + 1),
            })
            .collect();
        let owner = (0..track.trkseg.len()).collect();
        (parts, owner)
    };

    // the waypoints go with the segments that are the closest to them
    let segments: Vec<&TrackSegment> = file.trk.iter().flat_map(|track| &track.trkseg).collect();
    let mut waypoints: Vec<Vec<Waypoint>> = vec![vec![]; parts.len()];
    for waypoint in file.wpt.iter() {
        let mut owners: Vec<usize> = closest_segments(&segments, waypoint.coordinates)
            .into_iter()
            .map(|segment| owner[segment])
            .collect();
        owners.sort_unstable();
        owners.dedup();
        if owners.is_empty() {
            owners.push(0);
        }
        for (n, part) in owners.into_iter().enumerate() {
            // a waypoint that goes to several files has a new id in all but the first
            waypoints[part].push(if n == 0 {
                waypoint.clone()
            } else {
                copy_waypoint(waypoint)
            });
        }
    }

    parts
        .into_iter()
        .zip(waypoints)
        .map(|(part, waypoints)| {
            let mut extracted = File {
                id: Default::default(),
                trk: part.tracks,
                wpt: Waypoints::default(),
                ..file.clone()
            };
            extracted.info.name = part.name;
            extracted.wpt.insert_at(0, waypoints);
            extracted
        })
        .collect()
}

fn extract_tracks(
    state: &mut State,
    file_id: FileId,
    trk_ids: &HashSet<TrackId>,
) -> Result<(), CommandError> {
    let file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let mut changed = false;
    let mut tracks = vec![];
    let mut selected: HashSet<TrackId> = trk_ids.clone();
    for track in &file.trk {
        if trk_ids.contains(&track.id) && track.trkseg.len() > 1 {
            changed = true;
            selected.remove(&track.id);
            let pieces = split_track(track);
            selected.extend(pieces.iter().map(|piece| piece.id));
            tracks.extend(pieces);
        } else {
            tracks.push(track.clone());
        }
    }
    if !changed {
        return Err(CommandError::NothingToDo);
    }
    let mut file = (**file).clone();
    file.trk = tracks;
    state.files.insert(file_id, Rc::new(file));
    *state.selection = Selection::Track {
        file_id,
        trk_ids: selected,
    };
    Ok(())
}

/// The tracks that a track becomes: one per segment, the first one with the id of the track. The
/// others have the same info, with the name of the track and the number of the segment, if it has
/// a name. A track with at most one segment stays as it is.
fn split_track(track: &Track) -> Vec<Track> {
    if track.trkseg.len() <= 1 {
        return vec![track.clone()];
    }
    track
        .trkseg
        .iter()
        .enumerate()
        .map(|(i, segment)| {
            let mut piece = Track {
                id: if i == 0 { track.id } else { Default::default() },
                trkseg: vec![segment.clone()],
                ..track.clone()
            };
            piece.info.name = track
                .info
                .name
                .as_ref()
                .map(|name| format!("{name} ({})", i + 1));
            piece
        })
        .collect()
}

/// The indices of the segments that have the trackpoint that is the closest to `point`, which are
/// several when the closest trackpoints are as close.
///
/// The segments are looked at from the closest to the farthest bounds, which is how they are
/// left out: the ones whose bounds are farther than the closest trackpoint found.
fn closest_segments(segments: &[&TrackSegment], point: LngLat) -> Vec<usize> {
    let mut by_bounds: Vec<(f64, usize)> = segments
        .iter()
        .enumerate()
        .filter(|(_, segment)| !segment.is_empty())
        .map(|(i, segment)| {
            let mut bounds = LngLatBounds::default();
            segment
                .iter()
                .for_each(|trkpt| bounds.extend(trkpt.coordinates));
            (distance_to_bounds(&bounds, point), i)
        })
        .collect();
    by_bounds.sort_by(|a, b| a.0.total_cmp(&b.0));

    let mut closest = f64::MAX;
    let mut indices: Vec<usize> = vec![];
    for (bounds_distance, i) in by_bounds {
        if bounds_distance > closest {
            break;
        }
        for trkpt in segments[i].iter() {
            // in meters, like the distances to the bounds
            let d = distance(trkpt.coordinates, point) * 1000.0;
            if d < closest {
                closest = d;
                indices = vec![i];
            } else if d == closest {
                indices.push(i);
            }
        }
    }
    indices.sort_unstable();
    indices.dedup();
    indices
}

/// 0 inside the bounds, else the distance in meters to the closest side.
fn distance_to_bounds(bounds: &LngLatBounds, point: LngLat) -> f64 {
    let (sw, ne) = (bounds.sw, bounds.ne);
    if (sw.lng..=ne.lng).contains(&point.lng) && (sw.lat..=ne.lat).contains(&point.lat) {
        return 0.0;
    }
    let nw = LngLat {
        lng: sw.lng,
        lat: ne.lat,
    };
    let se = LngLat {
        lng: ne.lng,
        lat: sw.lat,
    };
    [(nw, ne), (ne, se), (se, sw), (sw, nw)]
        .into_iter()
        .map(|(a, b)| crossarc_lnglat(a, b, point))
        .fold(f64::MAX, f64::min)
}

#[cfg(test)]
mod tests {
    use crate::{TrackInfo, Trackpoint, engine::command::fixture::Fixture};

    use super::*;

    /// A segment of 5 trackpoints along the equator, from the longitude `from`.
    fn segment(from: f64) -> TrackSegment {
        let mut segment = TrackSegment::default();
        let points = (0..5)
            .map(|i| Trackpoint {
                coordinates: LngLat {
                    lng: from + i as f64 * 0.001,
                    lat: 0.0,
                },
                ..Default::default()
            })
            .collect();
        segment.splice(0, 0, points);
        segment
    }

    fn track(name: Option<&str>, from: &[f64]) -> Track {
        Track {
            info: TrackInfo {
                name: name.map(str::to_string),
                ..Default::default()
            },
            trkseg: from.iter().map(|from| segment(*from)).collect(),
            ..Default::default()
        }
    }

    fn waypoint(name: &str, lng: f64) -> Waypoint {
        Waypoint {
            name: Some(name.into()),
            coordinates: LngLat { lng, lat: 0.001 },
            ..Default::default()
        }
    }

    fn fixture(file: File) -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let id = file.id;
        fx.files.insert(id, Rc::new(file));
        fx.order.0.push(id);
        fx.selection = Selection::File {
            file_ids: [id].into(),
        };
        (fx, id)
    }

    fn file(name: &str, tracks: Vec<Track>, waypoints: Vec<Waypoint>) -> File {
        let mut file = File {
            trk: tracks,
            ..Default::default()
        };
        file.info.name = name.into();
        file.wpt.insert_at(0, waypoints);
        file
    }

    fn names(fx: &Fixture) -> Vec<String> {
        fx.order
            .0
            .iter()
            .map(|id| fx.files[id].info.name.clone())
            .collect()
    }

    #[test]
    fn test_a_file_with_one_track_becomes_one_file_per_segment() {
        let original = file(
            "route",
            vec![track(Some("climb"), &[0.0, 10.0, 20.0])],
            // near the first segment, near the last one, and in between, closer to the middle one
            vec![
                waypoint("a", 0.002),
                waypoint("c", 20.002),
                waypoint("b", 10.0),
            ],
        );
        let track_id = original.trk[0].id;
        let segment_ids: Vec<_> = original.trk[0].trkseg.iter().map(|s| s.id).collect();
        let (mut fx, id) = fixture(original);
        let other = file("other", vec![track(None, &[50.0])], vec![]);
        let other_id = other.id;
        fx.files.insert(other_id, Rc::new(other));
        fx.order.0.push(other_id);

        Extract.apply(&mut fx.state()).unwrap();

        // in the place of the file, in order, named after the track
        assert!(!fx.files.contains_key(&id));
        assert_eq!(names(&fx), ["climb (1)", "climb (2)", "climb (3)", "other"]);
        assert_eq!(fx.order.0[3], other_id);
        for (i, file_id) in fx.order.0[..3].iter().enumerate() {
            let file = &fx.files[file_id];
            assert_eq!(file.trk.len(), 1);
            assert_eq!(file.trk[0].trkseg.len(), 1);
            assert_eq!(file.trk[0].trkseg[0].id, segment_ids[i]);
            assert_eq!(file.trk[0].info.name.as_deref(), Some("climb"));
        }
        assert_eq!(fx.files[&fx.order.0[0]].trk[0].id, track_id);
        // the waypoints are with the closest segment
        let waypoints = |i: usize| -> Vec<String> {
            fx.files[&fx.order.0[i]]
                .wpt
                .iter()
                .map(|w| w.name.clone().unwrap())
                .collect()
        };
        assert_eq!(waypoints(0), ["a"]);
        assert_eq!(waypoints(1), ["b"]);
        assert_eq!(waypoints(2), ["c"]);
        // the new files are selected, the other one is not
        assert!(matches!(&fx.selection, Selection::File { file_ids }
            if file_ids.len() == 3 && !file_ids.contains(&other_id)));
    }

    #[test]
    fn test_a_file_with_several_tracks_becomes_one_file_per_track() {
        let original = file(
            "route",
            vec![
                track(Some("first"), &[0.0, 10.0]),
                track(None, &[20.0]),
                track(Some("third"), &[30.0, 40.0]),
            ],
            vec![],
        );
        let ids: Vec<_> = original.trk.iter().map(|t| t.id).collect();
        let (mut fx, _) = fixture(original);
        Extract.apply(&mut fx.state()).unwrap();

        // named after the track, or the file
        assert_eq!(names(&fx), ["first", "route (2)", "third"]);
        let tracks = |i: usize| &fx.files[&fx.order.0[i]].trk;
        // a track with several segments is split in as many tracks
        assert_eq!(tracks(0).len(), 2);
        assert_eq!(tracks(0)[0].info.name.as_deref(), Some("first (1)"));
        assert_eq!(tracks(0)[1].info.name.as_deref(), Some("first (2)"));
        assert_eq!(tracks(0)[0].id, ids[0]);
        // and one that has a single segment is not renamed
        assert_eq!(tracks(1).len(), 1);
        assert_eq!(tracks(1)[0].id, ids[1]);
        assert_eq!(tracks(1)[0].info.name, None);
        assert_eq!(tracks(2).len(), 2);
    }

    #[test]
    fn test_waypoints_with_closest_segments_that_tie_are_copied() {
        // the segments share a trackpoint, where the waypoint is: it is as close to both
        let a = segment(0.0);
        let b = segment(a[4].coordinates.lng);
        let shared = Waypoint {
            name: Some("mid".into()),
            coordinates: a[4].coordinates,
            ..Default::default()
        };
        let original = file(
            "f",
            vec![Track {
                trkseg: vec![a, b],
                ..Default::default()
            }],
            vec![shared, waypoint("lost", 100.0)],
        );
        let (mut fx, _) = fixture(original);
        Extract.apply(&mut fx.state()).unwrap();
        let first = &fx.files[&fx.order.0[0]];
        let second = &fx.files[&fx.order.0[1]];
        // the tie goes to both, with different ids
        let mid_in = |f: &File| {
            f.wpt
                .iter()
                .find(|w| w.name.as_deref() == Some("mid"))
                .map(|w| w.id)
        };
        assert!(mid_in(first).is_some() && mid_in(second).is_some());
        assert_ne!(mid_in(first), mid_in(second));
        // a far waypoint goes to its closest segment, which is the last one
        assert!(second.wpt.iter().any(|w| w.name.as_deref() == Some("lost")));
    }

    #[test]
    fn test_a_waypoint_of_a_file_without_trackpoints_is_kept() {
        let mut empty = TrackSegment::default();
        empty.rev_id = Default::default();
        let original = file(
            "f",
            vec![Track {
                trkseg: vec![empty.clone(), TrackSegment::default()],
                ..Default::default()
            }],
            vec![waypoint("w", 1.0)],
        );
        let (mut fx, _) = fixture(original);
        Extract.apply(&mut fx.state()).unwrap();
        assert_eq!(fx.files[&fx.order.0[0]].wpt.len(), 1);
        assert_eq!(fx.files[&fx.order.0[1]].wpt.len(), 0);
    }

    #[test]
    fn test_extract_tracks_in_place() {
        let original = file(
            "route",
            vec![
                track(Some("a"), &[0.0]),
                track(Some("b"), &[10.0, 20.0, 30.0]),
                track(None, &[40.0, 50.0]),
            ],
            vec![],
        );
        let ids: Vec<_> = original.trk.iter().map(|t| t.id).collect();
        let (mut fx, id) = fixture(original);
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [ids[1], ids[2]].into(),
        };

        Extract.apply(&mut fx.state()).unwrap();

        let file = &fx.files[&id];
        let names: Vec<_> = file.trk.iter().map(|t| t.info.name.clone()).collect();
        assert_eq!(
            names,
            [
                Some("a".into()),
                Some("b (1)".into()),
                Some("b (2)".into()),
                Some("b (3)".into()),
                None,
                None
            ]
        );
        assert_eq!(file.trk.len(), 6);
        assert!(file.trk.iter().all(|t| t.trkseg.len() == 1));
        assert_eq!(file.trk[0].id, ids[0]);
        assert_eq!(file.trk[1].id, ids[1]);
        // the new tracks are selected
        let Selection::Track { trk_ids, .. } = &fx.selection else {
            panic!("tracks are selected");
        };
        assert_eq!(trk_ids.len(), 5);
        assert!(trk_ids.contains(&ids[1]) && !trk_ids.contains(&ids[0]));
    }

    #[test]
    fn test_nothing_to_extract() {
        // a single segment
        let original = file("f", vec![track(Some("t"), &[0.0])], vec![]);
        let track_id = original.trk[0].id;
        let segment_id = original.trk[0].trkseg[0].id;
        let (mut fx, id) = fixture(original);
        let before = fx.files[&id].clone();
        assert_eq!(
            Extract.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: [track_id].into(),
        };
        assert_eq!(
            Extract.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        for selection in [
            Selection::Empty,
            Selection::Waypoints { file_id: id },
            Selection::TrackSegment {
                file_id: id,
                trk_id: track_id,
                trkseg_ids: [segment_id].into(),
            },
        ] {
            fx.selection = selection;
            assert_eq!(
                Extract.apply(&mut fx.state()),
                Err(CommandError::NothingToDo)
            );
        }
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
