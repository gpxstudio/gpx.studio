#[derive(Debug, Default)]
pub struct Link {
    pub href: String,
    pub text: Option<String>,
}

#[derive(Debug, Default)]
pub struct LngLat {
    pub lng: f64,
    pub lat: f64,
}

#[derive(Debug, Default)]
pub struct LngLatBounds {
    pub sw: LngLat,
    pub ne: LngLat,
}
