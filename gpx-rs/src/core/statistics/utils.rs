use std::ops::Add;

pub fn combine_options<T>(a: Option<T>, b: Option<T>, f: impl FnOnce(T, T) -> T) -> Option<T> {
    match (a, b) {
        (Some(a), Some(b)) => Some(f(a, b)),
        (Some(v), None) | (None, Some(v)) => Some(v),
        (None, None) => None,
    }
}

pub fn sum_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: Add<Output = T>,
{
    combine_options(a, b, |a, b| a + b)
}

pub fn min_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: Ord,
{
    combine_options(a, b, |a, b| a.min(b))
}

pub fn max_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: Ord,
{
    combine_options(a, b, |a, b| a.max(b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sum_options() {
        assert_eq!(sum_options(Some(1), Some(2)), Some(3));
        assert_eq!(sum_options(Some(1), None), Some(1));
        assert_eq!(sum_options(None, Some(2)), Some(2));
        assert_eq!(sum_options::<i32>(None, None), None);
        assert_eq!(sum_options(Some(0.5), Some(0.25)), Some(0.75));
    }
}
