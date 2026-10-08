use crate::{Link, TrackSegment};

use super::common::uuid_id;

uuid_id!(TrackId);

#[derive(Debug, Default, Clone)]
pub struct Track {
    pub id: TrackId,
    pub info: TrackInfo,
    pub trkseg: Vec<TrackSegment>,
}

#[derive(Debug, Default, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
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
