use std::rc::Rc;

use crate::{
    Apply, CommandError, File, Route, SegmentIndex, Selection, State, Track, TrackSegment,
    Waypoints, copy_file, copy_route, copy_segment, copy_track, copy_waypoint,
};

use super::route::find_target;

/// What is cut in two where the trackpoint is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SplitType {
    /// The file becomes two files, which both have the waypoints (copies, in the second one).
    Files,
    /// The route becomes two routes.
    Routes,
    /// The track becomes two tracks.
    Tracks,
    /// The segment of a track becomes two segments.
    Segments,
}

/// Cuts the file, the route, the track or the segment of the trackpoint `at` of the selection (see
/// `RoutingBuffer`) in two, there: the trackpoint is the last one of the first part and the first
/// one of the second part. Cutting a route needs the trackpoint to be in a route, and cutting a
/// track or a segment needs it to be in a track: there is nothing to do otherwise.
///
/// The first part keeps the ids of what is cut, the second one has new ids, as the elements that
/// come after the trackpoint (the following segments of the track, the following routes and
/// tracks of the file, the routes coming before the tracks), which are moved to it. When the file
/// is cut, the new file comes right after it. The selection does not change.
///
/// With `keep_originals`, a file that is cut (`SplitType::Files`) is left as it is: its two parts
/// are two new files, with new ids, which come right after it and are selected. Cutting a route, a
/// track or a segment changes the file in place anyway, so the flag has no effect on them.
#[derive(Debug)]
pub struct Split {
    pub at: u32,
    pub split_type: SplitType,
    pub keep_originals: bool,
}

impl Apply for Split {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let at = self.at as usize;
        let target = find_target(state, at, at)?.ok_or(CommandError::NothingToDo)?;
        let location = target.location;
        let (file_id, index) = (location.file_id, target.start);
        let in_route = matches!(location.index, SegmentIndex::Route(_));
        let fits = match self.split_type {
            SplitType::Files => true,
            SplitType::Routes => in_route,
            SplitType::Tracks | SplitType::Segments => !in_route,
        };
        if !fits {
            return Err(CommandError::NothingToDo);
        }
        let mut file = (*state.files[&file_id]).clone();
        if index >= file.segment(location.index).len() {
            return Err(CommandError::InvalidData(
                "trackpoint out of the segment".into(),
            ));
        }

        // with `SplitType::Files`, what goes to the second file: what comes after the trackpoint
        let mut second_file = File {
            id: Default::default(),
            rte: vec![],
            trk: vec![],
            wpt: Waypoints::default(),
            ..file.clone()
        };
        match location.index {
            SegmentIndex::Route(rte) => {
                let route = file.rte[rte].clone();
                let first = Route {
                    seg: keep_up_to(&route.seg, index),
                    ..route.clone()
                };
                let second = Route {
                    id: Default::default(),
                    seg: keep_from(&route.seg, index),
                    ..route.clone()
                };
                if self.split_type == SplitType::Routes {
                    file.rte.splice(rte..=rte, [first, second]);
                    state.files.insert(file_id, Rc::new(file));
                    return Ok(());
                }
                // the following routes, and the tracks, which come after the routes
                second_file.rte = [second]
                    .into_iter()
                    .chain(file.rte[rte + 1..].iter().map(copy_route))
                    .collect();
                second_file.trk = file.trk.iter().map(copy_track).collect();
                file.rte.truncate(rte);
                file.rte.push(first);
                file.trk.clear();
            }
            SegmentIndex::Track { trk, seg } => {
                let track = file.trk[trk].clone();
                let segment = &track.trkseg[seg];
                let (first, second) = (keep_up_to(segment, index), keep_from(segment, index));
                if self.split_type == SplitType::Segments {
                    file.trk[trk].trkseg.splice(seg..=seg, [first, second]);
                    state.files.insert(file_id, Rc::new(file));
                    return Ok(());
                }
                // the track is cut: what is before the segment, and its first part, then the
                // second part and what is after it
                let mut first_track = track.clone();
                first_track.trkseg.truncate(seg);
                first_track.trkseg.push(first);
                let mut second_track = Track {
                    id: Default::default(),
                    trkseg: vec![second],
                    ..track.clone()
                };
                second_track
                    .trkseg
                    .extend(track.trkseg[seg + 1..].iter().map(copy_segment));
                if self.split_type == SplitType::Tracks {
                    file.trk.splice(trk..=trk, [first_track, second_track]);
                    state.files.insert(file_id, Rc::new(file));
                    return Ok(());
                }
                second_file.trk = [second_track]
                    .into_iter()
                    .chain(file.trk[trk + 1..].iter().map(copy_track))
                    .collect();
                file.trk.truncate(trk);
                file.trk.push(first_track);
            }
        }

        // the file is cut: both parts have the waypoints
        second_file
            .wpt
            .insert_at(0, file.wpt.iter().map(copy_waypoint).collect());
        let position = state.order.0.iter().position(|id| *id == file_id);
        let at = position.map_or(state.order.0.len(), |p| p + 1);
        if self.keep_originals {
            // the parts are new files: nothing is shared by id with the file, nor between them
            let first_file = copy_file(&file);
            let ids = [first_file.id, second_file.id];
            state.order.0.splice(at..at, ids);
            state.files.insert(first_file.id, Rc::new(first_file));
            state.files.insert(second_file.id, Rc::new(second_file));
            *state.selection = Selection::File {
                file_ids: ids.into(),
            };
        } else {
            state.order.0.insert(at, second_file.id);
            state.files.insert(second_file.id, Rc::new(second_file));
            state.files.insert(file_id, Rc::new(file));
        }
        Ok(())
    }
}

/// The trackpoints of the segment up to `index` (included), in the same segment.
fn keep_up_to(segment: &TrackSegment, index: usize) -> TrackSegment {
    let mut part = segment.clone();
    let len = part.len();
    part.splice(index + 1, len, vec![]);
    part.rev_id = Default::default();
    part
}

/// The trackpoints of the segment from `index` (included), in a new segment.
fn keep_from(segment: &TrackSegment, index: usize) -> TrackSegment {
    let mut part = copy_segment(segment);
    part.splice(0, index, vec![]);
    part.rev_id = Default::default();
    part
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, Selection, TrackSegmentId, engine::command::fixture::Fixture};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
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

    fn split(at: u32, split_type: SplitType) -> Split {
        Split {
            at,
            split_type,
            keep_originals: false,
        }
    }

    fn lngs(segment: &TrackSegment) -> Vec<f64> {
        segment.iter().map(|p| p.coordinates.lng).collect()
    }

    fn path(file: &File) -> Vec<f64> {
        file.trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .flat_map(lngs)
            .collect()
    }

    /// The index in the selection of the trackpoint `local` of the segment `seg` of the track `trk`.
    fn index(file: &File, trk: usize, seg: usize, local: usize) -> u32 {
        let before: usize = file
            .trk
            .iter()
            .enumerate()
            .flat_map(|(t, track)| {
                track
                    .trkseg
                    .iter()
                    .enumerate()
                    .map(move |(s, segment)| ((t, s), segment.len()))
            })
            .take_while(|((t, s), _)| (*t, *s) != (trk, seg))
            .map(|(_, len)| len)
            .sum();
        (before + local) as u32
    }

    /// A segment with enough trackpoints, and its position.
    fn long_segment(file: &File) -> (usize, usize) {
        file.trk
            .iter()
            .enumerate()
            .flat_map(|(t, track)| (0..track.trkseg.len()).map(move |s| (t, s)))
            .find(|(t, s)| file.trk[*t].trkseg[*s].len() > 4)
            .unwrap()
    }

    #[test]
    fn test_split_segments() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let (trk, seg) = long_segment(&before);
        let original = &before.trk[trk].trkseg[seg];
        let len = original.len();

        split(index(&before, trk, seg, 2), SplitType::Segments)
            .apply(&mut fx.state())
            .unwrap();

        let after = &fx.files[&id];
        assert_eq!(after.trk.len(), before.trk.len());
        let segments = &after.trk[trk].trkseg;
        assert_eq!(segments.len(), before.trk[trk].trkseg.len() + 1);
        let (a, b) = (&segments[seg], &segments[seg + 1]);
        // the point is the end of the first part and the start of the second
        assert_eq!(lngs(a), lngs(original)[..=2]);
        assert_eq!(lngs(b), lngs(original)[2..]);
        assert_eq!(a.len() + b.len(), len + 1);
        // the first part keeps the id, the second one is new
        assert_eq!(a.id, original.id);
        assert_ne!(b.id, original.id);
        assert_ne!(a.rev_id, original.rev_id);
        // the ends are anchors
        assert_eq!(a[a.len() - 1].anchor, Some(0));
        assert_eq!(b[0].anchor, Some(0));
        // the rest of the file is untouched
        for (i, segment) in before.trk[trk].trkseg.iter().enumerate() {
            if i != seg {
                let moved = if i > seg { i + 1 } else { i };
                assert_eq!(segments[moved].rev_id, segment.rev_id);
            }
        }
    }

    #[test]
    fn test_split_tracks() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let (trk, seg) = long_segment(&before);

        split(index(&before, trk, seg, 3), SplitType::Tracks)
            .apply(&mut fx.state())
            .unwrap();

        let after = &fx.files[&id];
        assert_eq!(after.trk.len(), before.trk.len() + 1);
        let (a, b) = (&after.trk[trk], &after.trk[trk + 1]);
        assert_eq!(a.id, before.trk[trk].id);
        assert_ne!(b.id, a.id);
        // the segments before are in the first track, the ones after in the second one
        assert_eq!(a.trkseg.len(), seg + 1);
        assert_eq!(b.trkseg.len(), before.trk[trk].trkseg.len() - seg);
        // the segments before are the same ones, with the same trackpoints
        for (kept, original) in a.trkseg[..seg].iter().zip(&before.trk[trk].trkseg[..seg]) {
            assert_eq!((kept.id, kept.rev_id), (original.id, original.rev_id));
            let chunks = |segment: &TrackSegment| -> Vec<_> {
                segment.chunks().iter().map(|chunk| chunk.id).collect()
            };
            assert_eq!(chunks(kept), chunks(original));
        }
        // new ids for everything that moved, so that they are unique
        let ids: HashSet<TrackSegmentId> = after
            .trk
            .iter()
            .flat_map(|t| t.trkseg.iter().map(|s| s.id))
            .collect();
        assert_eq!(
            ids.len(),
            after.trk.iter().map(|t| t.trkseg.len()).sum::<usize>()
        );
        // the path goes on, with the point twice
        let mut expected = path(&before);
        let at = index(&before, trk, seg, 3) as usize;
        expected.insert(at, expected[at]);
        assert_eq!(path(after), expected);
        // the info of the track is the same
        assert_eq!(a.info, b.info);
    }

    #[test]
    fn test_split_files() {
        let (mut fx, id) = loaded();
        let mut file = (*fx.files[&id]).clone();
        let wpt = crate::Waypoint {
            name: Some("w".into()),
            ..Default::default()
        };
        file.wpt.insert_at(0, vec![wpt.clone()]);
        fx.files.insert(id, Rc::new(file));
        let before = fx.files[&id].clone();
        let (trk, seg) = long_segment(&before);
        let at = index(&before, trk, seg, 1);

        split(at, SplitType::Files).apply(&mut fx.state()).unwrap();

        assert_eq!(fx.files.len(), 2);
        let second_id = fx.order.0[1];
        assert_eq!(fx.order.0[0], id);
        assert_ne!(second_id, id);
        let (a, b) = (&fx.files[&id], &fx.files[&second_id]);
        // the first file stops at the point, the second one starts there
        let all = path(&before);
        assert_eq!(path(a), all[..=at as usize]);
        assert_eq!(path(b), all[at as usize..]);
        assert_eq!(a.info, b.info);
        // each has the waypoints, the copy has its own ids
        assert_eq!(a.wpt.len(), 1);
        assert_eq!(b.wpt.len(), 1);
        assert_ne!(a.wpt[0].id, b.wpt[0].id);
        assert_eq!(b.wpt[0].name, wpt.name);
        // nothing is shared by id between the two
        let ids = |f: &File| -> HashSet<_> {
            f.trk
                .iter()
                .flat_map(|t| std::iter::once(t.id.0).chain(t.trkseg.iter().map(|s| s.id.0)))
                .collect()
        };
        assert!(ids(a).is_disjoint(&ids(b)));
        // the selection is the same
        assert!(matches!(&fx.selection, Selection::File { file_ids } if file_ids.contains(&id)));
    }

    #[test]
    fn test_split_files_keeping_the_originals() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let (trk, seg) = long_segment(&before);
        let at = index(&before, trk, seg, 1);

        Split {
            at,
            split_type: SplitType::Files,
            keep_originals: true,
        }
        .apply(&mut fx.state())
        .unwrap();

        // the file is untouched, the two parts come right after it
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
        assert_eq!(fx.files.len(), 3);
        assert_eq!(fx.order.0[0], id);
        let (first_id, second_id) = (fx.order.0[1], fx.order.0[2]);
        let (a, b) = (&fx.files[&first_id], &fx.files[&second_id]);
        let all = path(&before);
        assert_eq!(path(a), all[..=at as usize]);
        assert_eq!(path(b), all[at as usize..]);
        // nothing is shared by id with the file, nor between the parts
        let ids = |f: &File| -> HashSet<_> {
            f.trk
                .iter()
                .flat_map(|t| std::iter::once(t.id.0).chain(t.trkseg.iter().map(|s| s.id.0)))
                .collect()
        };
        assert!(ids(a).is_disjoint(&ids(&before)));
        assert!(ids(b).is_disjoint(&ids(&before)));
        assert!(ids(a).is_disjoint(&ids(b)));
        // the new files are selected
        assert!(matches!(&fx.selection, Selection::File { file_ids }
            if *file_ids == HashSet::from([first_id, second_id])));
    }

    #[test]
    fn test_keeping_the_originals_does_not_matter_when_cutting_a_segment() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let (trk, seg) = long_segment(&before);

        Split {
            at: index(&before, trk, seg, 2),
            split_type: SplitType::Segments,
            keep_originals: true,
        }
        .apply(&mut fx.state())
        .unwrap();

        assert_eq!(fx.files.len(), 1);
        assert_eq!(
            fx.files[&id].trk[trk].trkseg.len(),
            before.trk[trk].trkseg.len() + 1
        );
    }

    #[test]
    fn test_invalid_or_nothing() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let total = path(&before).len() as u32;
        assert!(matches!(
            split(total + 5, SplitType::Segments).apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        // after the last trackpoint: appending, not a trackpoint
        assert!(matches!(
            split(total, SplitType::Segments).apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        fx.selection = Selection::Empty;
        assert_eq!(
            split(0, SplitType::Files).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
