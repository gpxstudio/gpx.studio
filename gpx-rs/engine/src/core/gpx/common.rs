#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Link {
    pub href: String,
    pub text: Option<String>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct LngLat {
    pub lng: f64,
    pub lat: f64,
}

#[derive(Debug)]
pub struct LngLatBounds {
    pub sw: LngLat,
    pub ne: LngLat,
}

impl Default for LngLatBounds {
    fn default() -> Self {
        Self {
            sw: LngLat {
                lng: 180.0,
                lat: 90.0,
            },
            ne: LngLat {
                lng: -180.0,
                lat: -90.0,
            },
        }
    }
}

impl LngLatBounds {
    pub fn extend(&mut self, coordinates: LngLat) {
        self.sw.lng = self.sw.lng.min(coordinates.lng);
        self.sw.lat = self.sw.lat.min(coordinates.lat);
        self.ne.lng = self.ne.lng.max(coordinates.lng);
        self.ne.lat = self.ne.lat.max(coordinates.lat);
    }

    pub fn merge(&mut self, other: &LngLatBounds) {
        self.sw.lng = self.sw.lng.min(other.sw.lng);
        self.sw.lat = self.sw.lat.min(other.sw.lat);
        self.ne.lng = self.ne.lng.max(other.ne.lng);
        self.ne.lat = self.ne.lat.max(other.ne.lat);
    }
}
