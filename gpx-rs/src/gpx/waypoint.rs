use crate::gpx::{Link, LngLat};

pub type WaypointChunk = Vec<Waypoint>;

#[derive(Debug, Default)]
pub struct Waypoint {
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
