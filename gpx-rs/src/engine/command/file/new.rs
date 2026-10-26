use crate::{
    Apply, CommandError, File, LngLat, Route, State, Track, TrackSegment, Trackpoint, produce,
};

/// Creates an empty file and selects it. With `route`, the file starts with a route, which is
/// empty. With a `trackpoint`, the file starts with a segment that holds it, the one of its route
/// with `route` or of a track otherwise: it is how the routing tool starts a route on an empty map,
/// in a single undo step.
#[derive(Debug)]
pub struct New<'a> {
    pub name: &'a str,
    pub trackpoint: Option<NewTrackpoint>,
    pub route: bool,
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
            let mut segment = TrackSegment::default();
            if let Some(point) = self.trackpoint {
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
            }
            if self.route {
                file.rte.push(Route {
                    seg: segment,
                    ..Default::default()
                });
            } else if self.trackpoint.is_some() {
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
                trackpoint: None,
                route: false,
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
            route: false,
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

    #[test]
    fn test_new_with_a_route() {
        let mut fx = Fixture::default();
        New {
            name: "new",
            trackpoint: None,
            route: true,
        }
        .apply(&mut fx.state())
        .unwrap();
        let file = fx.files.values().next().unwrap();
        assert_eq!((file.rte.len(), file.trk.len()), (1, 0));
        assert!(file.rte[0].seg.is_empty());
        assert_eq!(fx.selected_files(), [file.id].into());

        // the trackpoint goes to the route
        let mut fx = Fixture::default();
        New {
            name: "new",
            trackpoint: Some(NewTrackpoint {
                lng: 1.0,
                lat: 2.0,
                ele: 3.0,
            }),
            route: true,
        }
        .apply(&mut fx.state())
        .unwrap();
        let file = fx.files.values().next().unwrap();
        assert_eq!((file.rte.len(), file.trk.len()), (1, 0));
        assert_eq!(file.rte[0].seg.len(), 1);
        assert_eq!(file.rte[0].seg[0].anchor, Some(0));
    }
}
