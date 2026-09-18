use std::rc::Rc;

use crate::gpx::{Link, Track, WaypointChunk};

#[derive(Debug, Default)]
pub struct GPXFile {
    pub info: GPXFileInfo,
    pub trk: Vec<Track>,
    pub wpt: Vec<Rc<WaypointChunk>>,
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
