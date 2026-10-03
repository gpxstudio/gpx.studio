use std::collections::HashSet;

use crate::{FileId, TrackId, TrackSegmentId, WaypointId};

#[derive(Debug, Default)]
pub enum Selection {
    #[default]
    Empty,
    File {
        file_ids: HashSet<FileId>,
    },
    Track {
        file_id: FileId,
        trk_ids: HashSet<TrackId>,
    },
    TrackSegment {
        file_id: FileId,
        trk_id: TrackId,
        trkseg_ids: HashSet<TrackSegmentId>,
    },
    Waypoints {
        file_id: FileId,
    },
    Waypoint {
        file_id: FileId,
        wpt_ids: HashSet<WaypointId>,
    },
}
