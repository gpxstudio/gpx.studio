use crate::{File, Track, TrackSegment, Waypoint};

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

/// A copy of the file and of its tracks and segments, with new ids.
pub fn copy_file(file: &File) -> File {
    File {
        id: Default::default(),
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
