use uuid::Uuid;

use crate::{Link, LngLat};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct WaypointId(pub Uuid);

impl Default for WaypointId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
pub struct Waypoint {
    pub id: WaypointId,
    pub coordinates: LngLat,
    pub ele: f64,
    pub time: Option<i64>,
    pub name: Option<String>,
    pub cmt: Option<String>,
    pub desc: Option<String>,
    pub link: Option<Link>,
    pub sym: Option<String>,
    pub type_: Option<String>,
}

impl Waypoint {
    /// Whether the waypoints are the same, whatever their ids.
    pub fn same_content(&self, other: &Waypoint) -> bool {
        self.coordinates.lng == other.coordinates.lng
            && self.coordinates.lat == other.coordinates.lat
            && self.ele == other.ele
            && self.time == other.time
            && self.name == other.name
            && self.cmt == other.cmt
            && self.desc == other.desc
            && self.link == other.link
            && self.sym == other.sym
            && self.type_ == other.type_
    }
}
