use crate::LngLat;

#[derive(Debug, Default, Clone)]
pub struct Trackpoint {
    pub coordinates: LngLat,
    pub ele: f64,
    pub time: Option<i64>,
    pub atemp: Option<i16>,
    pub hr: Option<u16>,
    pub cad: Option<u16>,
    pub power: Option<u16>,
    /// Code of the surface, see [`crate::TrackpointCategories`].
    pub surface: Option<u8>,
    /// Code of the highway, see [`crate::TrackpointCategories`].
    pub highway: Option<u8>,
}
