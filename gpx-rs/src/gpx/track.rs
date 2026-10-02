use uuid::Uuid;

use crate::gpx::{Link, TrackSegment};

#[derive(Debug, PartialEq, Eq, Hash)]
pub struct TrackId(Uuid);

impl Default for TrackId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Default, PartialEq)]
pub struct Track {
    pub id: TrackId,
    pub info: TrackInfo,
    pub trkseg: Vec<TrackSegment>,
}

#[derive(Debug, Default, PartialEq)]
pub struct TrackInfo {
    pub name: Option<String>,
    pub cmt: Option<String>,
    pub desc: Option<String>,
    pub src: Option<String>,
    pub link: Option<Link>,
    pub type_: Option<String>,
    pub color: Option<String>,
    pub opacity: Option<f64>,
    pub width: Option<f64>,
}
