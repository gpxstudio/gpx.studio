use crate::{Link, Track, Waypoints};

use super::common::uuid_id;

uuid_id!(FileId);

#[derive(Debug, Default, Clone)]
pub struct File {
    pub id: FileId,
    pub info: FileInfo,
    pub trk: Vec<Track>,
    pub wpt: Waypoints,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct FileInfo {
    pub name: String,
    pub desc: Option<String>,
    pub author: Option<Author>,
    pub link: Option<Link>,
    pub time: Option<i64>,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Author {
    pub name: Option<String>,
    pub email: Option<String>,
    pub link: Option<Link>,
}
