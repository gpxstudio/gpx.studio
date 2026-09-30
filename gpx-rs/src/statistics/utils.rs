use std::ops::Add;

pub fn sum_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: Add<Output = T>,
{
    match (a, b) {
        (Some(a), Some(b)) => Some(a + b),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}
