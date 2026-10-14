use std::rc::Rc;

use crate::{Apply, CommandError, LngLat, SegmentLocation, State, Trackpoint, distance, projected};

/// Under this distance (in meters) to a trackpoint, that trackpoint becomes the anchor instead of
/// a new one being inserted next to it.
const SNAP_DISTANCE: f64 = 1.0;

/// Makes an anchor of the routing tool, shown at every zoom level, of the point of the selected
/// segments that is the closest to the given coordinates. That is the trackpoint itself if the
/// coordinates are on one, otherwise a new trackpoint is inserted on the path, at the position
/// of the coordinates projected on it, with an elevation and a time in between the ones of its
/// neighbours.
#[derive(Debug)]
pub struct InsertAnchor {
    pub lng: f64,
    pub lat: f64,
}

/// Where the anchor goes: between the trackpoints `before` and `before + 1` of a segment, at
/// `ratio` of the distance from the first one, which is `projection`. `distance` is the one from
/// there to the coordinates, in meters.
struct Position {
    location: SegmentLocation,
    before: usize,
    ratio: f64,
    projection: LngLat,
    distance: f64,
}

impl Apply for InsertAnchor {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let target = LngLat {
            lng: self.lng,
            lat: self.lat,
        };
        let mut closest: Option<Position> = None;
        for location in state
            .selection
            .segment_locations(state.files, &state.order.0)
        {
            let segment = &state.files[&location.file_id].trk[location.trk].trkseg[location.seg];
            let mut points = segment.iter();
            let Some(mut previous) = points.next() else {
                continue;
            };
            if segment.len() == 1 {
                // a single point is its own path
                let d = distance(previous.coordinates, target) * 1000.0;
                if closest.as_ref().is_none_or(|c| d < c.distance) {
                    closest = Some(Position {
                        location,
                        before: 0,
                        ratio: 0.0,
                        projection: previous.coordinates,
                        distance: d,
                    });
                }
            }
            for (i, point) in points.enumerate() {
                let projection = projected(previous.coordinates, point.coordinates, target);
                let d = distance(projection, target) * 1000.0;
                if closest.as_ref().is_none_or(|c| d < c.distance) {
                    let length = distance(previous.coordinates, point.coordinates);
                    let ratio = if length > 0.0 {
                        distance(previous.coordinates, projection) / length
                    } else {
                        0.0
                    };
                    closest = Some(Position {
                        location,
                        before: i,
                        ratio,
                        projection,
                        distance: d,
                    });
                }
                previous = point;
            }
        }
        let closest = closest.ok_or(CommandError::NothingToDo)?;

        let mut file = (*state.files[&closest.location.file_id]).clone();
        let segment = &mut file.trk[closest.location.trk].trkseg[closest.location.seg];
        let before = closest.before;
        // on a trackpoint already, if it is closer than `SNAP_DISTANCE`
        let snapped = if segment.len() == 1 {
            Some(0)
        } else {
            let (a, b) = (&segment[before], &segment[before + 1]);
            let meters = 1000.0 * distance(a.coordinates, b.coordinates);
            if closest.ratio * meters < SNAP_DISTANCE {
                Some(before)
            } else if (1.0 - closest.ratio) * meters < SNAP_DISTANCE {
                Some(before + 1)
            } else {
                None
            }
        };
        if let Some(index) = snapped {
            if segment[index].anchor == Some(0) {
                return Err(CommandError::NothingToDo);
            }
            segment.set_anchor(index, 0);
        } else {
            let (a, b) = (&segment[before], &segment[before + 1]);
            let ratio = closest.ratio;
            let mut point: Trackpoint = a.clone();
            point.coordinates = closest.projection;
            point.ele = (1.0 - ratio) * a.ele + ratio * b.ele;
            point.time = a
                .time
                .zip(b.time)
                .map(|(a, b)| ((1.0 - ratio) * a as f64 + ratio * b as f64) as i64);
            point.anchor = Some(0);
            segment.splice(before + 1, before + 1, vec![point]);
        }
        segment.rev_id = Default::default();
        state.files.insert(closest.location.file_id, Rc::new(file));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, Selection, engine::command::fixture::Fixture};

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

    fn first_segment(fx: &Fixture, id: FileId) -> crate::TrackSegment {
        fx.files[&id].trk[0].trkseg[0].clone()
    }

    #[test]
    fn test_a_point_is_inserted_between_its_neighbours() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = first_segment(&fx, id);
        let (a, b) = (&before[10], &before[11]);
        // a bit off the line, closer to the middle of the two points
        let target = LngLat {
            lng: (a.coordinates.lng + b.coordinates.lng) / 2.0 + 1e-6,
            lat: (a.coordinates.lat + b.coordinates.lat) / 2.0 + 1e-6,
        };
        InsertAnchor {
            lng: target.lng,
            lat: target.lat,
        }
        .apply(&mut fx.state())
        .unwrap();

        let after = first_segment(&fx, id);
        assert_eq!(after.len(), before.len() + 1);
        assert_ne!(after.rev_id, before.rev_id);
        let point = &after[11];
        assert_eq!(point.anchor, Some(0));
        assert_eq!(after[10].coordinates.lng, a.coordinates.lng);
        assert_eq!(after[12].coordinates.lng, b.coordinates.lng);
        // between its neighbours, with the interpolated elevation and time
        let ratio = (point.time.unwrap() - a.time.unwrap()) as f64
            / (b.time.unwrap() - a.time.unwrap()) as f64;
        assert!((0.3..0.7).contains(&ratio), "{ratio}");
        let expected = a.ele + ratio * (b.ele - a.ele);
        assert!(
            (point.ele - expected).abs() < 0.5,
            "{} {expected}",
            point.ele
        );
    }

    #[test]
    fn test_a_trackpoint_that_is_hit_becomes_the_anchor() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = first_segment(&fx, id);
        assert_eq!(before[10].anchor.is_some(), before[10].anchor == Some(0));
        let point = &before[10];
        InsertAnchor {
            lng: point.coordinates.lng,
            lat: point.coordinates.lat,
        }
        .apply(&mut fx.state())
        .unwrap();
        let after = first_segment(&fx, id);
        assert_eq!(after.len(), before.len());
        let anchors = (0..after.len())
            .filter(|i| after[*i].anchor == Some(0))
            .count();
        assert!(anchors >= 3, "{anchors}");
        assert!(
            after
                .iter()
                .zip(before.iter())
                .all(|(a, b)| a.coordinates.lng == b.coordinates.lng)
        );
        // doing it again changes nothing
        let again = InsertAnchor {
            lng: point.coordinates.lng,
            lat: point.coordinates.lat,
        }
        .apply(&mut fx.state());
        assert!(again.is_ok() || again == Err(CommandError::NothingToDo));
    }

    #[test]
    fn test_nothing_to_do_without_a_segment() {
        let (mut fx, _) = loaded("data/with_time.gpx");
        fx.selection = Selection::Empty;
        assert_eq!(
            InsertAnchor { lng: 1.0, lat: 1.0 }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
}
