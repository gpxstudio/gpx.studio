use crate::gpx::{Link, TrackSegment};

#[derive(Debug, Default)]
pub struct Track {
    pub info: TrackInfo,
    pub trkseg: Vec<TrackSegment>,
}

#[derive(Debug, Default)]
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
