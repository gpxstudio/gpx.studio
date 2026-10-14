use std::rc::Rc;

use crate::{
    Apply, Categories, CommandError, FileId, SegmentLocation, Selection, State, Statistics, Track,
    TrackSegment, Trackpoint, distance, replace_trackpoints,
};

/// The values of an OSM attribute (surface, highway...) of the new trackpoints of a [`Route`], as
/// the intervals of consecutive trackpoints that share one: `starts[i]` is the index of the first
/// trackpoint of the interval `i`, and `values[i]` its value, 0 when unknown, else 1 + the index
/// of its name in `names`. No intervals means that the attribute is unknown everywhere.
#[derive(Debug, Default, Clone, Copy)]
pub struct RouteCategory<'a> {
    pub starts: &'a [u32],
    pub values: &'a [u8],
    pub names: &'a [String],
}

impl RouteCategory<'_> {
    /// The code in `categories` of the value of each of the `len` new trackpoints. A name is
    /// added to the table of the categories if it is new.
    fn codes(
        &self,
        categories: &mut Categories,
        len: usize,
    ) -> Result<Vec<Option<u8>>, CommandError> {
        if self.starts.len() != self.values.len() {
            return Err(invalid("intervals of different lengths"));
        }
        let mut codes = vec![None; len];
        for (i, (start, value)) in self.starts.iter().zip(self.values).enumerate() {
            let end = self.starts.get(i + 1).map_or(len, |end| *end as usize);
            let start = *start as usize;
            if start > end || end > len {
                return Err(invalid("intervals out of the trackpoints"));
            }
            if *value == 0 {
                continue;
            }
            let name = self
                .names
                .get(usize::from(*value) - 1)
                .ok_or_else(|| invalid("unknown name of category"))?;
            codes[start..end].fill(categories.code(name));
        }
        Ok(codes)
    }
}

/// Replaces the trackpoints `start..end` of a segment of the selection by the given ones (a pure
/// insertion when `start == end`, a pure removal when there are no new points). It is how the
/// routing tool reroutes a part of a segment, extends it, or removes the end of it.
///
/// `start` and `end` are indices in the trackpoints of the selection (see `RoutingBuffer`): the
/// range has to be in a single segment, and `start == end == the number of trackpoints` appends
/// to the last one. If the selection has no trackpoints at all, they go to its last segment, which
/// is created if needed (in the last track, or in a new one, of the last selected file).
///
/// The timestamps follow: the new points get some if the segment has, at the speed it had on the
/// replaced part (see [`replace_trackpoints`]).
///
/// The new points listed in `anchors` become anchors of the routing tool, shown at every zoom
/// level. The anchors of the segment out of the range are kept, and the ends of the segment are
/// anchors anyway. The ones right before and after the range, between which the route goes, become
/// shown at every zoom level as well.
#[derive(Debug)]
pub struct Route<'a> {
    pub start: u32,
    pub end: u32,
    pub lng: &'a [f64],
    pub lat: &'a [f64],
    pub ele: &'a [f64],
    pub surface: RouteCategory<'a>,
    pub highway: RouteCategory<'a>,
    pub sac_scale: RouteCategory<'a>,
    pub mtb_scale: RouteCategory<'a>,
    /// Indices among the new trackpoints.
    pub anchors: &'a [u32],
}

fn invalid(message: &str) -> CommandError {
    CommandError::InvalidData(message.into())
}

/// A segment of the selection, and the range of its trackpoints that is concerned.
pub(super) struct Target {
    pub location: SegmentLocation,
    pub start: usize,
    pub end: usize,
}

impl Apply for Route<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let (start, end) = (self.start as usize, self.end as usize);
        let len = self.lng.len();
        if start > end || self.lat.len() != len || self.ele.len() != len {
            return Err(invalid("invalid trackpoints range"));
        }
        if self.anchors.iter().any(|anchor| *anchor as usize >= len) {
            return Err(invalid("anchor out of the new trackpoints"));
        }
        if start == end && len == 0 {
            return Err(CommandError::NothingToDo);
        }

        let categories = &mut *state.categories;
        let surface = self.surface.codes(&mut categories.surface, len)?;
        let highway = self.highway.codes(&mut categories.highway, len)?;
        let sac_scale = self.sac_scale.codes(&mut categories.sac_scale, len)?;
        let mtb_scale = self.mtb_scale.codes(&mut categories.mtb_scale, len)?;
        let points: Vec<Trackpoint> = (0..len)
            .map(|i| Trackpoint {
                coordinates: crate::LngLat {
                    lng: self.lng[i],
                    lat: self.lat[i],
                },
                ele: self.ele[i],
                surface: surface[i],
                highway: highway[i],
                sac_scale: sac_scale[i],
                mtb_scale: mtb_scale[i],
                ..Default::default()
            })
            .collect();
        let mut points = points;
        for anchor in self.anchors {
            points[*anchor as usize].anchor = Some(0);
        }

        let mut file;
        let target = match find_target(state, start, end)? {
            Some(target) => {
                file = (*state.files[&target.location.file_id]).clone();
                target
            }
            None => {
                let (file_id, trk) = container(state).ok_or(CommandError::NothingToDo)?;
                if start != 0 || end != 0 {
                    return Err(invalid("trackpoints range out of bounds"));
                }
                file = (*state.files[&file_id]).clone();
                // the segment of the last track, which may be new
                let trk = match trk.or_else(|| file.trk.len().checked_sub(1)) {
                    Some(trk) => trk,
                    None => {
                        file.trk.push(Track::default());
                        file.trk.len() - 1
                    }
                };
                if file.trk[trk].trkseg.is_empty() {
                    file.trk[trk].trkseg.push(TrackSegment::default());
                }
                let seg = file.trk[trk].trkseg.len() - 1;
                Target {
                    location: SegmentLocation { file_id, trk, seg },
                    start: 0,
                    end: 0,
                }
            }
        };

        let segment = &mut file.trk[target.location.trk].trkseg[target.location.seg];
        let new_len = points.len();
        let (speed, start_time) = speed_and_start_time(segment, &target, &points);
        let has_times = !segment.is_empty() && segment[0].time.is_some();
        if speed.is_some() || has_times {
            // the timestamps of the whole segment can change
            let mut all: Vec<Trackpoint> = segment.iter().cloned().collect();
            let old_len = all.len();
            replace_trackpoints(
                &mut all,
                target.start,
                target.end,
                points,
                speed,
                start_time,
                false,
            );
            segment.splice(0, old_len, all);
        } else {
            segment.splice(target.start, target.end, points);
        }
        // the anchors next to the new points are the ones that were moved or removed around:
        // they become permanent
        for index in [target.start.checked_sub(1), Some(target.start + new_len)]
            .into_iter()
            .flatten()
        {
            if index < segment.len() && segment[index].anchor.is_some_and(|zoom| zoom != 0) {
                segment.set_anchor(index, 0);
            }
        }
        segment.rev_id = Default::default();
        state.files.insert(target.location.file_id, Rc::new(file));
        Ok(())
    }
}

/// The segment of the trackpoints `start..end` of the selection.
pub(super) fn find_target(
    state: &State,
    start: usize,
    end: usize,
) -> Result<Option<Target>, CommandError> {
    let locations = state
        .selection
        .segment_locations(state.files, &state.order.0);
    let segments: Vec<(SegmentLocation, usize)> = locations
        .into_iter()
        .map(|location| {
            let segment = &state.files[&location.file_id].trk[location.trk].trkseg[location.seg];
            (location, segment.len())
        })
        .collect();
    let total: usize = segments.iter().map(|(_, len)| len).sum();

    if total == 0 {
        // an empty segment of the selection, if there is one
        return match segments.last() {
            Some((location, _)) if start == 0 && end == 0 => Ok(Some(Target {
                location: *location,
                start: 0,
                end: 0,
            })),
            Some(_) => Err(invalid("trackpoints range out of bounds")),
            None => Ok(None),
        };
    }

    let mut offset = 0;
    for (location, len) in segments.iter().filter(|(_, len)| *len > 0) {
        // appending to the selection is appending to its last segment
        let appends = offset + len == total && start == total;
        if start >= offset && (start < offset + len || appends) {
            if end > offset + len {
                return Err(invalid("trackpoints range over several segments"));
            }
            return Ok(Some(Target {
                location: *location,
                start: start - offset,
                end: end - offset,
            }));
        }
        offset += len;
    }
    Err(invalid("trackpoints range out of bounds"))
}

/// The file, and the track (if the selection is one), where to create a segment in a selection
/// that has none.
fn container(state: &State) -> Option<(FileId, Option<usize>)> {
    match &*state.selection {
        Selection::File { file_ids } => {
            let id = state
                .order
                .0
                .iter()
                .rev()
                .find(|id| file_ids.contains(id))
                .or_else(|| file_ids.iter().next())?;
            state.files.contains_key(id).then_some((*id, None))
        }
        Selection::Track { file_id, trk_ids } => {
            let trk = state
                .files
                .get(file_id)?
                .trk
                .iter()
                .rposition(|trk| trk_ids.contains(&trk.id))?;
            Some((*file_id, Some(trk)))
        }
        _ => None,
    }
}

/// The speed at which the new points are reached and the time of the first one, when the segment
/// has times to keep consistent: the speed is the one that the segment had on the part that is
/// replaced, adjusted so that the moving speed of the whole segment stays what it was.
///
/// The replaced part goes from the trackpoint before the range (the anchor that stays) to the one
/// after it, or to the ends of the segment: the new points are the route between them.
///
/// This is what the routing tool computed from the statistics of the segment before.
fn speed_and_start_time(
    segment: &TrackSegment,
    target: &Target,
    points: &[Trackpoint],
) -> (Option<f64>, Option<i64>) {
    let time_at = |index: usize| {
        (index < segment.len())
            .then(|| segment[index].time)
            .flatten()
    };
    let start_time = time_at(target.start);
    if points.is_empty() || segment.is_empty() {
        return (None, start_time);
    }
    let stats = Statistics::compute(segment);
    let Some(moving_speed) = stats.global.moving_speed().filter(|speed| *speed > 0.0) else {
        return (None, start_time);
    };

    // the statistics where the replaced part starts and ends
    let first_index = target.start.saturating_sub(1);
    let last_index = target.end.min(segment.len() - 1);
    let (first, last) = (&stats.local[first_index], &stats.local[last_index]);
    let moving_distance =
        |stats: &crate::TrackpointStatistics| stats.moving_distance.unwrap_or(0.0);
    let moving_time = |stats: &crate::TrackpointStatistics| stats.moving_time.unwrap_or(0);
    let total_time = |stats: &crate::TrackpointStatistics| stats.total_time.unwrap_or(0);

    let replacing_distance: f64 = points
        .windows(2)
        .map(|pair| distance(pair[0].coordinates, pair[1].coordinates))
        .sum();
    let replaced_distance = moving_distance(last) - moving_distance(first);
    let global_moving_distance = stats.global.moving_distance.unwrap_or(0.0);
    let new_distance = global_moving_distance + replacing_distance - replaced_distance;
    // in milliseconds
    let new_time = new_distance / moving_speed * 3_600_000.0;
    let remaining_time = stats.global.moving_time.unwrap_or(0) as f64
        - (moving_time(last) - moving_time(first)) as f64;
    let mut replacing_time = new_time - remaining_time;
    if replacing_time <= 0.0 {
        // fall back to the time that the replaced part took
        replacing_time = (total_time(last) - total_time(first)) as f64;
    }
    let speed = replacing_distance / (replacing_time / 3_600_000.0);

    let start_time = start_time.or_else(|| {
        // The first trackpoint has no time: the new points end when the last replaced one did,
        // after the time they take and the time that the segment was not moving until then.
        // (Suspicious: without a time for the last one either, it is "0", the year 1970.)
        let end_time = time_at(last_index);
        let stopped = (total_time(last) - moving_time(last)) as f64;
        Some(end_time.unwrap_or(0) - (replacing_time + stopped) as i64)
    });
    (Some(speed), start_time)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{File, Load, TrackSegmentId, engine::command::fixture::Fixture};

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

    fn select_file(fx: &mut Fixture, id: FileId) {
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
    }

    /// The first segment of the file with segments, selected.
    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/with_tracks_and_segments.gpx");
        let trk = &fx.files[&id].trk[0];
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trk.trkseg[0].id]),
        };
        (fx, id)
    }

    fn route<'a>(
        start: u32,
        end: u32,
        lng: &'a [f64],
        lat: &'a [f64],
        ele: &'a [f64],
    ) -> Route<'a> {
        Route {
            start,
            end,
            lng,
            lat,
            ele,
            surface: Default::default(),
            highway: Default::default(),
            sac_scale: Default::default(),
            mtb_scale: Default::default(),
            anchors: &[],
        }
    }

    fn segment(fx: &Fixture, id: FileId, trk: usize, seg: usize) -> &TrackSegment {
        &fx.files[&id].trk[trk].trkseg[seg]
    }

    #[test]
    fn test_route_replaces_points_of_the_selected_segment_only() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let len = before.trk[0].trkseg[0].len();
        assert!(len >= 3);

        route(1, 3, &[1.0, 2.0, 3.0], &[4.0, 5.0, 6.0], &[7.0, 8.0, 9.0])
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
    fn test_route_append_and_remove() {
        let (mut fx, id) = loaded();
        let len = fx.files[&id].trk[0].trkseg[0].len() as u32;
        route(len, len, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        let seg = segment(&fx, id, 0, 0);
        assert_eq!(seg.len(), len as usize + 1);
        assert_eq!(seg[len as usize].ele, 3.0);

        route(0, len + 1, &[], &[], &[])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(segment(&fx, id, 0, 0).len(), 0);
    }

    #[test]
    fn test_route_invalid_arguments_change_nothing() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let len = before.trk[0].trkseg[0].len() as u32;
        let results = [
            route(2, 1, &[], &[], &[]).apply(&mut fx.state()),
            route(0, 0, &[1.0], &[], &[]).apply(&mut fx.state()),
            route(0, len + 1, &[], &[], &[]).apply(&mut fx.state()),
            route(len + 1, len + 1, &[1.0], &[1.0], &[1.0]).apply(&mut fx.state()),
            Route {
                anchors: &[1],
                ..route(0, 0, &[1.0], &[1.0], &[1.0])
            }
            .apply(&mut fx.state()),
        ];
        assert!(
            results
                .iter()
                .all(|r| matches!(r, Err(CommandError::InvalidData(_)))),
            "{results:?}"
        );
        assert_eq!(
            route(0, 0, &[], &[], &[]).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }

    #[test]
    fn test_route_needs_a_selection_with_a_file() {
        let (mut fx, _) = loaded();
        fx.selection = Selection::Empty;
        assert_eq!(
            route(0, 0, &[1.0], &[1.0], &[1.0]).apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_route_indices_are_in_the_selection() {
        let (mut fx, id) = loaded();
        let file = fx.files[&id].clone();
        select_file(&mut fx, id);
        let lens: Vec<_> = file
            .trk
            .iter()
            .flat_map(|trk| trk.trkseg.iter().map(|segment| segment.len()))
            .collect();
        assert!(lens.len() >= 2);

        // inside the second segment
        let second = lens[0] as u32;
        route(second + 1, second + 2, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        let (trk, seg) = (0, 1);
        let segments_before: Vec<_> = file.trk.iter().flat_map(|t| &t.trkseg).collect();
        let files = fx.files[&id].clone();
        let segments_after: Vec<_> = files.trk.iter().flat_map(|t| &t.trkseg).collect();
        for (i, (b, a)) in segments_before.iter().zip(&segments_after).enumerate() {
            assert_eq!(a.rev_id != b.rev_id, i == 1, "segment {i}");
        }
        assert_eq!(segment(&fx, id, trk, seg)[1].coordinates.lng, 1.0);

        // a range over two segments
        let total: usize = lens.iter().sum();
        assert!(matches!(
            route(second - 1, second + 1, &[], &[], &[]).apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        // after the last point: the last segment
        let before = segments_after.last().unwrap().len();
        let total = total as u32;
        route(total, total, &[1.0], &[2.0], &[3.0])
            .apply(&mut fx.state())
            .unwrap();
        let last = fx.files[&id].trk.last().unwrap().trkseg.last().unwrap();
        assert_eq!(last.len(), before + 1);
    }

    #[test]
    fn test_route_creates_the_segment_of_a_selection_that_has_none() {
        let mut fx = Fixture::default();
        let file = File::default();
        let id = file.id;
        fx.files.insert(id, Rc::new(file));
        fx.order.0.push(id);
        select_file(&mut fx, id);

        route(0, 0, &[1.0, 2.0], &[1.0, 2.0], &[3.0, 4.0])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(fx.files[&id].trk.len(), 1);
        assert_eq!(segment(&fx, id, 0, 0).len(), 2);
        // the ends are anchors
        assert_eq!(segment(&fx, id, 0, 0)[0].anchor, Some(0));
        assert_eq!(segment(&fx, id, 0, 0)[1].anchor, Some(0));

        // a track with no segments
        let mut file = (*fx.files[&id]).clone();
        file.trk[0].trkseg.clear();
        let trk_id = file.trk[0].id;
        fx.files.insert(id, Rc::new(file));
        fx.selection = Selection::Track {
            file_id: id,
            trk_ids: HashSet::from([trk_id]),
        };
        route(0, 0, &[5.0], &[5.0], &[5.0])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(fx.files[&id].trk.len(), 1);
        assert_eq!(segment(&fx, id, 0, 0).len(), 1);

        // an empty segment is the target as well
        let mut file = (*fx.files[&id]).clone();
        file.trk[0].trkseg[0] = TrackSegment::default();
        let seg_id: TrackSegmentId = file.trk[0].trkseg[0].id;
        fx.files.insert(id, Rc::new(file));
        fx.selection = Selection::TrackSegment {
            file_id: id,
            trk_id,
            trkseg_ids: HashSet::from([seg_id]),
        };
        route(0, 0, &[6.0], &[6.0], &[6.0])
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(segment(&fx, id, 0, 0).len(), 1);
        assert_eq!(fx.files[&id].trk[0].trkseg.len(), 1);
    }

    #[test]
    fn test_route_anchors() {
        let (mut fx, id) = loaded();
        let len = segment(&fx, id, 0, 0).len();
        assert!(len > 4);
        let anchors_before: Vec<_> = segment(&fx, id, 0, 0).iter().map(|p| p.anchor).collect();

        // 5 new points replacing the 2 in the middle, two of them are anchors
        let (lng, lat, ele) = ([1.0; 5], [2.0; 5], [3.0; 5]);
        Route {
            anchors: &[1, 3],
            ..route(1, 3, &lng, &lat, &ele)
        }
        .apply(&mut fx.state())
        .unwrap();
        let anchors: Vec<_> = segment(&fx, id, 0, 0).iter().map(|p| p.anchor).collect();
        assert_eq!(anchors.len(), len + 3);
        assert_eq!(anchors[2], Some(0));
        assert_eq!(anchors[4], Some(0));
        assert_eq!(anchors[1], None);
        assert_eq!(anchors[3], None);
        assert_eq!(anchors[5], None);
        // the others stay as they were, the ends are always anchors
        assert_eq!(anchors[0], Some(0));
        assert_eq!(anchors[len + 2], Some(0));
        assert_eq!(anchors[len + 2 - 1], anchors_before[len - 2]);
    }

    #[test]
    fn test_route_makes_the_anchors_around_the_range_permanent() {
        let (mut fx, id) = loaded();
        let mut file = (*fx.files[&id]).clone();
        let len = file.trk[0].trkseg[0].len();
        assert!(len > 8);
        // anchors shown from different zoom levels, around and away from the range 4..6
        for (index, zoom) in [(1, 7), (3, 9), (6, 12), (8, 14)] {
            file.trk[0].trkseg[0].set_anchor(index, zoom);
        }
        fx.files.insert(id, Rc::new(file));

        route(4, 6, &[1.0, 2.0], &[3.0, 4.0], &[5.0, 6.0])
            .apply(&mut fx.state())
            .unwrap();
        let anchors: Vec<_> = segment(&fx, id, 0, 0).iter().map(|p| p.anchor).collect();
        assert_eq!(anchors.len(), len);
        // right before and after the new points: permanent
        assert_eq!(anchors[3], Some(0));
        assert_eq!(anchors[6], Some(0));
        // the others are as they were
        assert_eq!(anchors[1], Some(7));
        assert_eq!(anchors[8], Some(14));
    }

    #[test]
    fn test_route_categories() {
        let (mut fx, id) = loaded();
        let names = ["asphalt".to_string(), "gravel".to_string()];
        let (lng, lat, ele) = ([1.0; 4], [2.0; 4], [3.0; 4]);
        // asphalt, asphalt, unknown, gravel
        Route {
            surface: RouteCategory {
                starts: &[0, 2, 3],
                values: &[1, 0, 2],
                names: &names,
            },
            highway: RouteCategory {
                starts: &[0],
                values: &[1],
                names: &["track".to_string()],
            },
            ..route(0, 0, &lng, &lat, &ele)
        }
        .apply(&mut fx.state())
        .unwrap();
        let file = fx.files[&id].clone();
        let seg = &file.trk[0].trkseg[0];
        let asphalt = fx.categories.surface.code("asphalt");
        let gravel = fx.categories.surface.code("gravel");
        let surfaces: Vec<_> = (0..4).map(|i| seg[i].surface).collect();
        assert_eq!(surfaces, [asphalt, asphalt, None, gravel]);
        let track = fx.categories.highway.code("track");
        assert!((0..4).all(|i| seg[i].highway == track));
        assert!((0..4).all(|i| seg[i].sac_scale.is_none() && seg[i].mtb_scale.is_none()));

        // broken intervals or names
        let broken = [
            RouteCategory {
                starts: &[0, 1],
                values: &[1],
                names: &names,
            },
            RouteCategory {
                starts: &[5],
                values: &[1],
                names: &names,
            },
            RouteCategory {
                starts: &[0],
                values: &[3],
                names: &names,
            },
        ];
        for surface in broken {
            let result = Route {
                surface,
                ..route(0, 0, &lng, &lat, &ele)
            }
            .apply(&mut fx.state());
            assert!(matches!(result, Err(CommandError::InvalidData(_))));
        }
    }

    /// A segment of `data/with_time.gpx`, selected: 80 trackpoints at 20 km/h.
    fn timed() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/with_time.gpx");
        select_file(&mut fx, id);
        (fx, id)
    }

    fn times(seg: &TrackSegment) -> Vec<i64> {
        seg.iter().map(|p| p.time.unwrap()).collect()
    }

    #[test]
    fn test_route_gives_times_to_the_new_points() {
        let (mut fx, id) = timed();
        let seg = segment(&fx, id, 0, 0);
        let (n, before) = (seg.len(), times(seg));
        let duration = before[n - 1] - before[0];

        // replace the points 20..40 by the straight line between them, with 5 points
        let (a, b) = (seg[20].coordinates, seg[39].coordinates);
        let at = |t: f64| (a.lng + t * (b.lng - a.lng), a.lat + t * (b.lat - a.lat));
        let positions: Vec<_> = (0..5).map(|i| at(i as f64 / 4.0)).collect();
        let lng: Vec<_> = positions.iter().map(|p| p.0).collect();
        let lat: Vec<_> = positions.iter().map(|p| p.1).collect();
        route(20, 40, &lng, &lat, &[0.0; 5])
            .apply(&mut fx.state())
            .unwrap();

        let seg = segment(&fx, id, 0, 0);
        assert_eq!(seg.len(), n - 15);
        let after = times(seg);
        assert!(after.windows(2).all(|w| w[0] < w[1]), "{after:?}");
        // the points before are untouched
        assert_eq!(after[..20], before[..20]);
        // the speed of the replaced part is the one of the segment: the duration of the segment
        // is about the same as on the same distance
        let stats = Statistics::compute(seg);
        let speed = stats.global.moving_speed().unwrap();
        assert!((speed - 20.0).abs() < 1.0, "{speed}");
        assert!(after[after.len() - 1] - after[0] <= duration);
    }

    #[test]
    fn test_route_between_anchors_that_stay_keeps_them_untouched() {
        let (mut fx, id) = timed();
        let seg = segment(&fx, id, 0, 0);
        let (n, before) = (seg.len(), times(seg));
        let (a, b) = (seg[20].clone(), seg[39].clone());
        // 5 points on the line between the anchors 20 and 39, which are not replaced
        let at = |t: f64| {
            (
                a.coordinates.lng + t * (b.coordinates.lng - a.coordinates.lng),
                a.coordinates.lat + t * (b.coordinates.lat - a.coordinates.lat),
            )
        };
        let positions: Vec<_> = (1..=5).map(|i| at(i as f64 / 6.0)).collect();
        let lng: Vec<_> = positions.iter().map(|p| p.0).collect();
        let lat: Vec<_> = positions.iter().map(|p| p.1).collect();
        route(21, 39, &lng, &lat, &[0.0; 5])
            .apply(&mut fx.state())
            .unwrap();

        let seg = segment(&fx, id, 0, 0);
        assert_eq!(seg.len(), n - 18 + 5);
        let after = times(seg);
        assert!(after.windows(2).all(|w| w[0] < w[1]), "{after:?}");
        // the anchors keep their coordinates and times, and what is before them
        assert_eq!(after[..=20], before[..=20]);
        assert_eq!(seg[26].coordinates.lng, b.coordinates.lng);
        assert_eq!(after[26], before[39]);
        // and what comes after is unchanged as well
        assert_eq!(after[27..], before[40..]);
        let speed = Statistics::compute(seg).global.moving_speed().unwrap();
        assert!((speed - 20.0).abs() < 1.0, "{speed}");
    }

    #[test]
    fn test_route_appending_to_a_segment_with_times() {
        let (mut fx, id) = timed();
        let seg = segment(&fx, id, 0, 0);
        let n = seg.len();
        let last = seg[n - 1].clone();
        // replace the last point and go 1 km further east
        let lng = [last.coordinates.lng, last.coordinates.lng + 0.009];
        let lat = [last.coordinates.lat; 2];
        route(n as u32 - 1, n as u32, &lng, &lat, &[0.0; 2])
            .apply(&mut fx.state())
            .unwrap();
        let seg = segment(&fx, id, 0, 0);
        assert_eq!(seg.len(), n + 1);
        // the replaced point is reached at the speed of the segment: about at its time
        assert!((seg[n - 1].time.unwrap() - last.time.unwrap()).abs() < 1000);
        let (a, b) = (seg[n - 1].time.unwrap(), seg[n].time.unwrap());
        // the new point is reached at about 20 km/h
        let km = distance(seg[n - 1].coordinates, seg[n].coordinates);
        let seconds = (b - a) as f64 / 1000.0;
        let expected = 3600.0 * km / 20.0;
        assert!(
            (seconds - expected).abs() < 0.1 * expected,
            "{seconds} {expected}"
        );
    }

    #[test]
    fn test_route_does_not_invent_times() {
        let mut fx = Fixture::default();
        let id = load(&mut fx, "data/simple.gpx");
        select_file(&mut fx, id);
        assert!(segment(&fx, id, 0, 0).iter().all(|p| p.time.is_none()));
        route(0, 2, &[1.0, 2.0], &[3.0, 4.0], &[5.0, 6.0])
            .apply(&mut fx.state())
            .unwrap();
        assert!(segment(&fx, id, 0, 0).iter().all(|p| p.time.is_none()));
    }
}
