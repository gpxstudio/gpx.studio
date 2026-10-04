/// Maps the values of a category of trackpoint data (the surface, the highway...) to small codes,
/// so that the trackpoints only hold a `u8` instead of a string.
///
/// The codes are the positions of the names in the order of first appearance. The table only
/// grows: a code never changes meaning, so it stays valid in every state of the history.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Categories(Vec<String>);

impl Categories {
    /// Maximum number of distinct values.
    pub const CAPACITY: usize = u8::MAX as usize;

    /// The code of `name`, which is added to the table if it is new. `None` if the table is full.
    pub fn code(&mut self, name: &str) -> Option<u8> {
        let index = match self.0.iter().position(|known| known == name) {
            Some(index) => index,
            None if self.0.len() < Self::CAPACITY => {
                self.0.push(name.to_owned());
                self.0.len() - 1
            }
            None => return None,
        };
        u8::try_from(index).ok()
    }

    /// The name of a code, `None` if it is unknown.
    pub fn name(&self, code: u8) -> Option<&str> {
        self.0.get(usize::from(code)).map(String::as_str)
    }

    /// All the names, in the order of their codes.
    pub fn names(&self) -> &[String] {
        &self.0
    }
}

/// The categories of the data of the trackpoints. There is one table per engine, shared by all
/// its files.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct TrackpointCategories {
    pub surface: Categories,
    pub highway: Categories,
    pub sac_scale: Categories,
    pub mtb_scale: Categories,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_codes_follow_the_order_of_appearance() {
        let mut categories = Categories::default();
        assert_eq!(categories.code("asphalt"), Some(0));
        assert_eq!(categories.code("gravel"), Some(1));
        // a known name keeps its code
        assert_eq!(categories.code("asphalt"), Some(0));
        assert_eq!(categories.names(), ["asphalt", "gravel"]);
    }

    #[test]
    fn test_names_of_codes() {
        let mut categories = Categories::default();
        let code = categories.code("asphalt").unwrap();
        assert_eq!(categories.name(code), Some("asphalt"));
        assert_eq!(categories.name(code + 1), None);
        assert_eq!(Categories::default().name(0), None);
    }

    #[test]
    fn test_a_full_table_gives_no_code_to_new_names() {
        let mut categories = Categories::default();
        for i in 0..Categories::CAPACITY {
            assert_eq!(categories.code(&i.to_string()), Some(i as u8));
        }
        assert_eq!(categories.code("one too many"), None);
        assert_eq!(categories.names().len(), Categories::CAPACITY);
        // the known ones still have their code, the last one included
        assert_eq!(categories.code("0"), Some(0));
        assert_eq!(categories.code("254"), Some(254));
        assert_eq!(categories.name(254), Some("254"));
    }

    #[test]
    fn test_the_categories_are_independent() {
        let mut categories = TrackpointCategories::default();
        categories.surface.code("asphalt");
        assert_eq!(categories.highway.code("path"), Some(0));
        assert_eq!(categories.sac_scale.code("hiking"), Some(0));
        assert_eq!(categories.mtb_scale.code("1"), Some(0));
        assert_eq!(categories.surface.names(), ["asphalt"]);
        assert_eq!(categories.highway.names(), ["path"]);
        assert_eq!(categories.sac_scale.names(), ["hiking"]);
        assert_eq!(categories.mtb_scale.names(), ["1"]);
    }
}
