/// Defines an identifier made of a UUID, which is a new one by default.
macro_rules! uuid_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
        pub struct $name(pub uuid::Uuid);

        impl Default for $name {
            fn default() -> Self {
                Self(uuid::Uuid::new_v4())
            }
        }
    };
}

pub(crate) use uuid_id;

#[derive(Debug, Default, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Link {
    pub href: String,
    pub text: Option<String>,
}

#[derive(Debug, Default, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct LngLat {
    pub lng: f64,
    pub lat: f64,
}

#[derive(Debug, Clone, Copy)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bounds_extend() {
        let mut bounds = LngLatBounds::default();
        bounds.extend(LngLat {
            lng: 4.0,
            lat: 50.0,
        });
        assert_eq!((bounds.sw.lng, bounds.sw.lat), (4.0, 50.0));
        assert_eq!((bounds.ne.lng, bounds.ne.lat), (4.0, 50.0));

        bounds.extend(LngLat {
            lng: 6.0,
            lat: 45.0,
        });
        bounds.extend(LngLat {
            lng: 5.0,
            lat: 48.0,
        });
        assert_eq!((bounds.sw.lng, bounds.sw.lat), (4.0, 45.0));
        assert_eq!((bounds.ne.lng, bounds.ne.lat), (6.0, 50.0));
    }

    #[test]
    fn test_bounds_merge() {
        let mut a = LngLatBounds::default();
        a.extend(LngLat { lng: 0.0, lat: 0.0 });
        a.extend(LngLat { lng: 1.0, lat: 1.0 });
        let mut b = LngLatBounds::default();
        b.extend(LngLat {
            lng: -2.0,
            lat: 0.5,
        });
        b.extend(LngLat { lng: 0.5, lat: 3.0 });

        a.merge(&b);
        assert_eq!((a.sw.lng, a.sw.lat), (-2.0, 0.0));
        assert_eq!((a.ne.lng, a.ne.lat), (1.0, 3.0));

        // merging an empty bounds changes nothing
        a.merge(&LngLatBounds::default());
        assert_eq!((a.sw.lng, a.sw.lat), (-2.0, 0.0));
        assert_eq!((a.ne.lng, a.ne.lat), (1.0, 3.0));
    }
}
