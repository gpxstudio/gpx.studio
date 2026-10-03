use std::rc::Rc;

use uuid::Uuid;

use crate::{Link, Track, WaypointChunk};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FileId(pub Uuid);

impl Default for FileId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct File {
    pub id: FileId,
    pub info: FileInfo,
    pub trk: Vec<Track>,
    pub wpt: Vec<Rc<WaypointChunk>>,
    // TODO routes
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
