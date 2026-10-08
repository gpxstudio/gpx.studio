//! The binary form of what is stored: a version byte, then the data (postcard).

use std::rc::Rc;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    File, FileInfo, Track, TrackId, TrackInfo, TrackSegment, TrackSegmentId, Trackpoint,
    TrackpointChunk, TrackpointChunkId, Waypoint, WaypointChunk, WaypointChunkId, Waypoints,
};

/// Changes when the form of the records does.
const VERSION: u8 = 1;

pub fn encode<T: Serialize + ?Sized>(value: &T) -> Vec<u8> {
    postcard::to_extend(value, vec![VERSION]).expect("serializing to memory")
}

pub fn decode<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> Option<T> {
    match bytes.split_first() {
        Some((&VERSION, data)) => postcard::from_bytes(data).ok(),
        _ => None,
    }
}

/// A file without its trackpoints and waypoints, which are in chunks.
#[derive(Serialize, Deserialize)]
pub struct FileRecord {
    info: FileInfo,
    tracks: Vec<TrackRecord>,
    waypoints: Vec<WaypointChunkId>,
}

#[derive(Serialize, Deserialize)]
struct TrackRecord {
    id: TrackId,
    info: TrackInfo,
    segments: Vec<SegmentRecord>,
}

#[derive(Serialize, Deserialize)]
struct SegmentRecord {
    id: TrackSegmentId,
    chunks: Vec<TrackpointChunkId>,
}

impl FileRecord {
    pub fn new(file: &File) -> Self {
        Self {
            info: file.info.clone(),
            tracks: file
                .trk
                .iter()
                .map(|track| TrackRecord {
                    id: track.id,
                    info: track.info.clone(),
                    segments: track
                        .trkseg
                        .iter()
                        .map(|segment| SegmentRecord {
                            id: segment.id,
                            chunks: segment.chunks().iter().map(|chunk| chunk.id).collect(),
                        })
                        .collect(),
                })
                .collect(),
            waypoints: file.wpt.chunks().iter().map(|chunk| chunk.id).collect(),
        }
    }

    /// The file made of the record and its chunks, `None` if one is missing. Chunks that several
    /// files use stay shared.
    pub fn build(
        self,
        id: crate::FileId,
        trackpoint_chunks: &impl Fn(&TrackpointChunkId) -> Option<Rc<TrackpointChunk>>,
        waypoint_chunks: &impl Fn(&WaypointChunkId) -> Option<Rc<WaypointChunk>>,
    ) -> Option<File> {
        let mut file = File {
            id,
            info: self.info,
            ..Default::default()
        };
        for track in self.tracks {
            let mut trkseg = Vec::with_capacity(track.segments.len());
            for segment in track.segments {
                let mut built = TrackSegment::default();
                built.id = segment.id;
                for chunk in &segment.chunks {
                    built.push_shared(trackpoint_chunks(chunk)?);
                }
                trkseg.push(built);
            }
            file.trk.push(Track {
                id: track.id,
                info: track.info,
                trkseg,
            });
        }
        let mut wpt = Waypoints::default();
        for chunk in &self.waypoints {
            wpt.push_shared(waypoint_chunks(chunk)?);
        }
        file.wpt = wpt;
        Some(file)
    }
}

pub fn encode_trackpoints(chunk: &TrackpointChunk) -> Vec<u8> {
    encode(&chunk.trkpt)
}

pub fn decode_trackpoints(id: Uuid, bytes: &[u8]) -> Option<TrackpointChunk> {
    Some(TrackpointChunk {
        id: TrackpointChunkId(id),
        trkpt: decode::<Vec<Trackpoint>>(bytes)?,
    })
}

pub fn encode_waypoints(chunk: &WaypointChunk) -> Vec<u8> {
    encode(&chunk.wpt)
}

pub fn decode_waypoints(id: Uuid, bytes: &[u8]) -> Option<WaypointChunk> {
    Some(WaypointChunk {
        id: WaypointChunkId(id),
        wpt: decode::<Vec<Waypoint>>(bytes)?,
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::Chunk;

    use super::*;

    fn trackpoints(n: usize) -> TrackpointChunk {
        TrackpointChunk::new(
            (0..n)
                .map(|i| Trackpoint {
                    ele: i as f64,
                    ..Default::default()
                })
                .collect(),
        )
    }

    #[test]
    fn test_encode_decode_round_trip() {
        let value = vec![(1_u32, "a".to_string()), (2, "b".to_string())];
        let bytes = encode(&value);
        assert_eq!(bytes[0], VERSION);
        assert_eq!(decode::<Vec<(u32, String)>>(&bytes), Some(value));
    }

    #[test]
    fn test_decode_rejects_other_versions_and_garbage() {
        let mut bytes = encode(&42_u32);
        assert_eq!(decode::<u32>(&bytes), Some(42));
        bytes[0] = VERSION + 1;
        assert_eq!(decode::<u32>(&bytes), None);
        assert_eq!(decode::<u32>(&[]), None);
        // the right version, but not what was asked for
        assert_eq!(decode::<Vec<String>>(&[VERSION, 0xff, 0xff, 0xff]), None);
        assert_eq!(decode::<u32>(&[VERSION]), None);
    }

    #[test]
    fn test_chunks_keep_their_identity_and_items() {
        let chunk = trackpoints(3);
        let decoded = decode_trackpoints(chunk.id.0, &encode_trackpoints(&chunk)).unwrap();
        assert_eq!(decoded.id, chunk.id);
        let eles: Vec<f64> = decoded.trkpt.iter().map(|p| p.ele).collect();
        assert_eq!(eles, [0.0, 1.0, 2.0]);
        assert!(decode_trackpoints(chunk.id.0, &[VERSION, 9, 9]).is_none());

        let chunk = WaypointChunk::new(vec![Waypoint {
            name: Some("summit".into()),
            ..Default::default()
        }]);
        let decoded = decode_waypoints(chunk.id.0, &encode_waypoints(&chunk)).unwrap();
        assert_eq!(decoded.id, chunk.id);
        assert_eq!(decoded.wpt[0].name.as_deref(), Some("summit"));
        assert!(decode_waypoints(chunk.id.0, &[]).is_none());
    }

    fn file() -> File {
        let mut file = File::default();
        file.info.name = "file".into();
        for name in ["a", "b"] {
            let mut track = Track::default();
            track.info.name = Some(name.into());
            let mut segment = TrackSegment::default();
            segment.push(trackpoints(2));
            segment.push(trackpoints(1));
            track.trkseg.push(segment);
            track.trkseg.push(TrackSegment::default());
            file.trk.push(track);
        }
        file.wpt.push(WaypointChunk::new(vec![Waypoint::default()]));
        file
    }

    /// The chunks of a file, by identity.
    fn chunks_of(
        file: &File,
    ) -> (
        HashMap<TrackpointChunkId, Rc<TrackpointChunk>>,
        HashMap<WaypointChunkId, Rc<WaypointChunk>>,
    ) {
        let trackpoints = file
            .trk
            .iter()
            .flat_map(|track| &track.trkseg)
            .flat_map(|segment| segment.chunks().iter().map(|c| (c.id, c.clone())))
            .collect();
        let waypoints = file
            .wpt
            .chunks()
            .iter()
            .map(|c| (c.id, c.clone()))
            .collect();
        (trackpoints, waypoints)
    }

    #[test]
    fn test_file_record_rebuilds_the_file_with_the_same_chunks() {
        let file = file();
        let (trackpoints, waypoints) = chunks_of(&file);
        let record: FileRecord = decode(&encode(&FileRecord::new(&file))).unwrap();
        let built = record
            .build(file.id, &|id| trackpoints.get(id).cloned(), &|id| {
                waypoints.get(id).cloned()
            })
            .unwrap();

        assert_eq!(built.id, file.id);
        assert_eq!(built.info, file.info);
        assert_eq!(built.trk.len(), 2);
        for (built, original) in built.trk.iter().zip(&file.trk) {
            assert_eq!(built.id, original.id);
            assert_eq!(built.info, original.info);
            assert_eq!(built.trkseg.len(), 2);
            for (built, original) in built.trkseg.iter().zip(&original.trkseg) {
                assert_eq!(built.id, original.id);
                assert_eq!(built.len(), original.len());
                for (a, b) in built.chunks().iter().zip(original.chunks()) {
                    // the chunks are the ones that were given, not copies
                    assert!(Rc::ptr_eq(a, b));
                }
            }
        }
        assert_eq!(built.wpt.len(), 1);
        assert!(Rc::ptr_eq(&built.wpt.chunks()[0], &file.wpt.chunks()[0]));
    }

    #[test]
    fn test_file_record_of_a_missing_chunk_builds_nothing() {
        let file = file();
        let (trackpoints, waypoints) = chunks_of(&file);

        let record = || FileRecord::new(&file);
        assert!(
            record()
                .build(file.id, &|_| None, &|id| waypoints.get(id).cloned())
                .is_none()
        );
        assert!(
            record()
                .build(file.id, &|id| trackpoints.get(id).cloned(), &|_| None)
                .is_none()
        );
    }

    #[test]
    fn test_file_record_without_data_builds_an_empty_file() {
        let file = File::default();
        let built = FileRecord::new(&file)
            .build(file.id, &|_| None, &|_| None)
            .unwrap();
        assert!(built.trk.is_empty() && built.wpt.is_empty());
    }
}
