use crate::{Apply, CommandError, File, LngLat, State, Track, TrackSegment, Trackpoint, produce};

/// Creates an empty file and selects it. With a `trackpoint`, the file starts with a track and a
/// segment that hold it: it is how the routing tool starts a route on an empty map, in a single
/// undo step.
#[derive(Debug)]
pub struct New<'a> {
    pub name: &'a str,
    pub trackpoint: Option<NewTrackpoint>,
}

#[derive(Debug, Clone, Copy)]
pub struct NewTrackpoint {
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
}

impl Apply for New<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        produce(state, |_| {
            let mut file = File::default();
            file.info.name = self.name.to_owned();
            if let Some(point) = self.trackpoint {
                let mut segment = TrackSegment::default();
                // the ends of a segment are anchors of the routing tool
                segment.splice(
                    0,
                    0,
                    vec![Trackpoint {
                        coordinates: LngLat {
                            lng: point.lng,
                            lat: point.lat,
                        },
                        ele: point.ele,
                        ..Default::default()
                    }],
                );
                file.trk.push(Track {
                    trkseg: vec![segment],
                    ..Default::default()
                });
            }
            vec![file]
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;

    use super::*;

    #[test]
    fn test_new() {
        let mut fx = Fixture::default();
        assert!(
            New {
                name: "new",
                trackpoint: None
            }
            .apply(&mut fx.state())
            .is_ok()
        );
        assert_eq!(fx.files.len(), 1);
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.info.name, "new");
        assert!(file.trk.is_empty());
        assert_eq!(fx.selected_files(), [file.id].into());
        assert_eq!(fx.order.0, vec![file.id]);
    }

    #[test]
    fn test_new_with_a_trackpoint() {
        let mut fx = Fixture::default();
        let point = NewTrackpoint {
            lng: 1.0,
            lat: 2.0,
            ele: 3.0,
        };
        New {
            name: "new",
            trackpoint: Some(point),
        }
        .apply(&mut fx.state())
        .unwrap();
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.trk.len(), 1);
        assert_eq!(file.trk[0].trkseg.len(), 1);
        let segment = &file.trk[0].trkseg[0];
        assert_eq!(segment.len(), 1);
        assert_eq!(segment[0].coordinates.lng, 1.0);
        assert_eq!(segment[0].coordinates.lat, 2.0);
        assert_eq!(segment[0].ele, 3.0);
        // the only trackpoint is an anchor of the routing tool
        assert_eq!(segment[0].anchor, Some(0));
        assert_eq!(fx.selected_files(), [file.id].into());
    }
}
