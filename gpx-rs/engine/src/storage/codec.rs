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
