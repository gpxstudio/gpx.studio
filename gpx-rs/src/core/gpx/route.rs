use crate::{TrackInfo, TrackSegment};

use super::common::uuid_id;

uuid_id!(RouteId);

/// A route of the file (`rte`): like a track, but with a single segment, its points.
///
/// It has the information of a track: GPX gives the same to both.
#[derive(Debug, Default, Clone)]
pub struct Route {
    pub id: RouteId,
    pub info: TrackInfo,
    pub seg: TrackSegment,
}
