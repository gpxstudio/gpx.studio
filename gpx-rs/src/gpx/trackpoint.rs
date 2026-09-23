use crate::gpx::LngLat;

#[derive(Debug, Default)]
pub struct Trackpoint {
    pub coordinates: LngLat,
    pub ele: f64,
    pub time: Option<i64>,
    pub atemp: Option<i16>,
    pub hr: Option<u16>,
    pub cad: Option<u16>,
    pub power: Option<u16>,
    // TODO OSM data? or store intervals at a higher level?
}

impl Trackpoint {
    pub fn time_diff(&self, other: &Trackpoint) -> Option<i64> {
        self.time.zip(other.time).map(|(t1, t2)| t1 - t2)
    }
}
