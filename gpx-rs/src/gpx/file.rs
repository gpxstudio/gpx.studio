use std::rc::Rc;

use uuid::Uuid;

use crate::gpx::{Link, Track, WaypointChunk};

#[derive(Debug)]
pub struct GPXFile {
    pub id: Uuid,
    pub info: GPXFileInfo,
    pub trk: Vec<Track>,
    pub wpt: Vec<Rc<WaypointChunk>>,
    // TODO routes
}

impl Default for GPXFile {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            info: Default::default(),
            trk: Default::default(),
            wpt: Default::default(),
        }
    }
}

#[derive(Debug, Default)]
pub struct GPXFileInfo {
    pub name: String,
    pub desc: Option<String>,
    pub author: Option<Author>,
    pub link: Option<Link>,
    pub time: Option<i64>,
}

#[derive(Debug, Default)]
pub struct Author {
    pub name: Option<String>,
    pub email: Option<String>,
    pub link: Option<Link>,
}
