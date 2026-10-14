//! Typed arrays and files cross as raw bytes (little-endian), not as JSON.

pub type Bytes = tauri::ipc::Response;

pub fn f64s(values: &[f64]) -> Bytes {
    Bytes::new(
        values
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<u8>>(),
    )
}

pub fn u32s(values: &[u32]) -> Bytes {
    Bytes::new(
        values
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect::<Vec<u8>>(),
    )
}

pub fn u8s(values: &[u8]) -> Bytes {
    Bytes::new(values.to_vec())
}

/// An array that can be absent: the first byte tells whether it is there, the array follows.
pub fn optional(array: Option<Vec<u8>>) -> Bytes {
    let mut bytes = vec![u8::from(array.is_some())];
    bytes.extend(array.unwrap_or_default());
    Bytes::new(bytes)
}

pub fn f64_bytes(values: &[f64]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}

pub fn i64_bytes(values: &[i64]) -> Vec<u8> {
    values.iter().flat_map(|v| v.to_le_bytes()).collect()
}
