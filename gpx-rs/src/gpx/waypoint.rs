use crate::gpx::{Link, LngLat};

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

static MAX_CHUNK_SIZE: usize = 128;

#[derive(Debug, Default)]
pub struct WaypointChunk {
    pub wpt: Vec<Waypoint>,
}

impl WaypointChunk {
    pub fn is_full(&self) -> bool {
        self.wpt.len() == MAX_CHUNK_SIZE
    }
}
