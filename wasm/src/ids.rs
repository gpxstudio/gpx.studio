//! Ids, which cross as strings (one id) or as concatenated 16-byte UUIDs (several).

use uuid::Uuid;

pub(crate) fn uuid_list(bytes: &[u8]) -> Option<Vec<Uuid>> {
    let (chunks, rest) = bytes.as_chunks::<16>();
    rest.is_empty()
        .then(|| chunks.iter().map(|c| Uuid::from_bytes(*c)).collect())
}

pub(crate) fn parse_uuid(id: &str) -> Option<Uuid> {
    Uuid::parse_str(id).ok()
}

pub(crate) fn same_len(a: &[f64], b: &[f64], c: &[f64]) -> bool {
    a.len() == b.len() && b.len() == c.len()
}
