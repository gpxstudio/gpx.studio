use uuid::Uuid;

use crate::gpx::{Link, LngLat};

#[derive(Debug, PartialEq, Eq)]
pub struct WaypointId(Uuid);

impl Default for WaypointId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default)]
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
