use std::rc::Rc;

pub type GPXFileId = usize;

pub struct GPXFile {
    pub id: GPXFileId,
    pub info: Rc<GPXFileInfo>,
    pub trk: Vec<Track>,
    pub wpt: Vec<Rc<WaypointChunk>>,
}

impl GPXFile {
    pub fn new(id: GPXFileId, name: &str) -> Self {
        Self {
            id,
            info: Rc::new(GPXFileInfo::new(name)),
            trk: Vec::new(),
            wpt: Vec::new(),
        }
    }
}

pub struct GPXFileInfo {
    pub name: String,
    pub desc: Option<String>,
    pub author: Option<Author>,
    pub link: Option<Link>,
    pub time: Option<i64>,
}

impl GPXFileInfo {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_owned(),
            desc: None,
            author: None,
            link: None,
            time: None,
        }
    }
}

pub struct Author {
    pub name: Option<String>,
    pub email: Option<String>,
    pub link: Option<Link>,
}

pub struct Link {
    pub href: String,
    pub text: Option<String>,
    pub type_: Option<String>,
}

pub struct Track {
    pub info: Rc<TrackInfo>,
    pub trkseg: Vec<TrackSegment>,
}

pub struct TrackInfo {
    name: Option<String>,
    cmt: Option<String>,
    desc: Option<String>,
    src: Option<String>,
    link: Option<Link>,
    type_: Option<String>,
    color: Option<String>,
    opacity: Option<f64>,
    width: Option<f64>,
}

pub struct TrackSegment {
    pub trkpt: Vec<Rc<TrackPointChunk>>,
}

pub type TrackPointChunk = Vec<TrackPoint>;

pub struct TrackPoint {
    pub coordinates: LngLat,
    pub ele: f64,
    pub time: Option<i64>,
    pub hr: Option<u16>,
    pub cad: Option<u16>,
    pub power: Option<u16>,
    pub atemp: Option<i16>,
    // TODO OSM data? or store intervals at a higher level?
}

pub type WaypointChunk = Vec<Waypoint>;

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

pub struct LngLat {
    pub lng: f64,
    pub lat: f64,
}
