use crate::{File, Route, Track, TrackSegment, Waypoint};

// The trackpoints of a segment are shared chunks, so copying elements is cheap.

/// A copy of the segment, with a new id.
pub fn copy_segment(segment: &TrackSegment) -> TrackSegment {
    let mut copy = segment.clone();
    copy.id = Default::default();
    copy
}

/// A copy of the track and of its segments, with new ids.
pub fn copy_track(track: &Track) -> Track {
    Track {
        id: Default::default(),
        trkseg: track.trkseg.iter().map(copy_segment).collect(),
        ..track.clone()
    }
}

/// A copy of the route and of its segment, with new ids.
pub fn copy_route(route: &Route) -> Route {
    Route {
        id: Default::default(),
        seg: copy_segment(&route.seg),
        ..route.clone()
    }
}

/// A copy of the file and of its routes, tracks and segments, with new ids.
pub fn copy_file(file: &File) -> File {
    File {
        id: Default::default(),
        rte: file.rte.iter().map(copy_route).collect(),
        trk: file.trk.iter().map(copy_track).collect(),
        ..file.clone()
    }
}

/// A copy of the waypoint, with a new id.
pub fn copy_waypoint(waypoint: &Waypoint) -> Waypoint {
    let mut copy = waypoint.clone();
    copy.id = Default::default();
    copy
}
