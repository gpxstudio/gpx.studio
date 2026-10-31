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
    /// Code of the SAC hiking scale, see [`crate::TrackpointCategories`].
    pub sac_scale: Option<u8>,
    /// Code of the mountain biking scale, see [`crate::TrackpointCategories`].
    pub mtb_scale: Option<u8>,
    /// Whether the trackpoint is an anchor of the routing tool (a point the user can drag to
    /// reroute the segment): the lowest map zoom level at which it is shown. The first and last
    /// trackpoints of a segment are always anchors that are always shown (zoom 0).
    pub anchor: Option<u8>,
}
