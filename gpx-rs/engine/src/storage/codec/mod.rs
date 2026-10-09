//! The binary form of what is stored.
//!
//! Every blob starts with a version byte, then the data (postcard, which does not name the fields:
//! the form is exactly the types that wrote it). So a form never changes once it has been
//! written: the types of each version live in their own module (see [`v1`]) and are frozen, and
//! a change is a new version next to them. Blobs of any known version can be read; they are
//! written again in the latest version when they are written again. Chunks are never rewritten
//! unless they change, so blobs of several versions live together in a storage.
//!
//! To change the form: add `vN`, make `LATEST` its number, convert from it in the decoders, and
//! keep the golden bytes of the older versions in the tests.

mod v1;

use std::rc::Rc;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    File, FileId, FileInfo, Track, TrackId, TrackInfo, TrackSegment, TrackSegmentId,
    TrackpointCategories, TrackpointChunk, TrackpointChunkId, Waypoint, WaypointChunk,
    WaypointChunkId, Waypoints,
};

/// The version that is written.
pub const LATEST: u8 = 1;

/// Why a blob could not be read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecodeError {
    /// It was written by a version that this one does not know: a newer one, or not a blob.
    UnknownVersion(u8),
    /// It has a known version, but not what it should have.
    Corrupt,
}

fn encode<T: Serialize + ?Sized>(value: &T) -> Vec<u8> {
    postcard::to_extend(value, vec![LATEST]).expect("serializing to memory")
}

/// The version of a blob, and its data.
fn split(bytes: &[u8]) -> Result<(u8, &[u8]), DecodeError> {
    bytes
        .split_first()
        .map(|(v, data)| (*v, data))
        .ok_or(DecodeError::Corrupt)
}

fn parse<'a, T: Deserialize<'a>>(data: &'a [u8]) -> Result<T, DecodeError> {
    postcard::from_bytes(data).map_err(|_| DecodeError::Corrupt)
}

/// A file without its trackpoints and waypoints, which are in chunks.
pub struct FileRecord {
    info: FileInfo,
    tracks: Vec<TrackRecord>,
    waypoints: Vec<WaypointChunkId>,
}

struct TrackRecord {
    id: TrackId,
    info: TrackInfo,
    segments: Vec<SegmentRecord>,
}

struct SegmentRecord {
    id: TrackSegmentId,
    chunks: Vec<TrackpointChunkId>,
}

impl From<v1::FileRecord1> for FileRecord {
    fn from(record: v1::FileRecord1) -> Self {
        Self {
            info: record.info.into(),
            tracks: record
                .tracks
                .into_iter()
                .map(|track| TrackRecord {
                    id: TrackId(track.id),
                    info: track.info.into(),
                    segments: track
                        .segments
                        .into_iter()
                        .map(|segment| SegmentRecord {
                            id: TrackSegmentId(segment.id),
                            chunks: segment.chunks.into_iter().map(TrackpointChunkId).collect(),
                        })
                        .collect(),
                })
                .collect(),
            waypoints: record.waypoints.into_iter().map(WaypointChunkId).collect(),
        }
    }
}

impl FileRecord {
    /// The file made of the record and its chunks, `None` if one is missing. Chunks that several
    /// files use stay shared.
    pub fn build(
        self,
        id: FileId,
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

pub fn encode_file(file: &File) -> Vec<u8> {
    encode(&v1::FileRecord1::new(file))
}

pub fn decode_file(bytes: &[u8]) -> Result<FileRecord, DecodeError> {
    match split(bytes)? {
        (1, data) => Ok(parse::<v1::FileRecord1>(data)?.into()),
        (version, _) => Err(DecodeError::UnknownVersion(version)),
    }
}

/// The bytes of a chunk of trackpoints. Its surfaces, highways and scales are written as names,
/// the codes of `categories` being the ones of the engine that has the chunk.
pub fn encode_trackpoints(chunk: &TrackpointChunk, categories: &TrackpointCategories) -> Vec<u8> {
    encode(&v1::TrackpointChunk1::new(&chunk.trkpt, categories))
}

/// A chunk of trackpoints from its bytes. The names it holds are added to `categories` if it does
/// not know them yet, and the trackpoints refer to them by the codes of `categories`.
pub fn decode_trackpoints(
    id: Uuid,
    bytes: &[u8],
    categories: &mut TrackpointCategories,
) -> Result<TrackpointChunk, DecodeError> {
    let trkpt = match split(bytes)? {
        (1, data) => parse::<v1::TrackpointChunk1>(data)?.into_points(categories),
        (version, _) => return Err(DecodeError::UnknownVersion(version)),
    };
    Ok(TrackpointChunk {
        id: TrackpointChunkId(id),
        trkpt,
    })
}

pub fn encode_waypoints(chunk: &WaypointChunk) -> Vec<u8> {
    encode(
        &chunk
            .wpt
            .iter()
            .map(v1::Waypoint1::from)
            .collect::<Vec<_>>(),
    )
}

pub fn decode_waypoints(id: Uuid, bytes: &[u8]) -> Result<WaypointChunk, DecodeError> {
    let wpt = match split(bytes)? {
        (1, data) => parse::<Vec<v1::Waypoint1>>(data)?
            .into_iter()
            .map(Waypoint::from)
            .collect(),
        (version, _) => return Err(DecodeError::UnknownVersion(version)),
    };
    Ok(WaypointChunk {
        id: WaypointChunkId(id),
        wpt,
    })
}

pub fn encode_order(order: &[FileId]) -> Vec<u8> {
    encode(&order.iter().map(|id| id.0).collect::<Vec<_>>())
}

pub fn decode_order(bytes: &[u8]) -> Result<Vec<FileId>, DecodeError> {
    match split(bytes)? {
        (1, data) => Ok(parse::<Vec<Uuid>>(data)?.into_iter().map(FileId).collect()),
        (version, _) => Err(DecodeError::UnknownVersion(version)),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::{Author, Chunk, Link, LngLat, Trackpoint};

    use super::*;

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn link(href: &str) -> Link {
        Link {
            href: href.into(),
            text: Some(format!("text of {href}")),
        }
    }

    fn trackpoint(n: u8) -> Trackpoint {
        let f = f64::from(n);
        Trackpoint {
            coordinates: LngLat {
                lng: 4.0 + f,
                lat: 50.0 + f,
            },
            ele: 100.5 + f,
            time: Some(1_700_000_000_000 + i64::from(n)),
            atemp: Some(-3),
            hr: Some(140 + u16::from(n)),
            cad: Some(80),
            power: Some(250),
            // the first has the second name of the table, which comes first in the chunk
            surface: Some(if n == 0 { 1 } else { 0 }),
            highway: Some(0),
            sac_scale: Some(0),
            mtb_scale: Some(0),
            anchor: Some(n),
        }
    }

    fn waypoint() -> Waypoint {
        Waypoint {
            id: crate::WaypointId(id(7)),
            coordinates: LngLat {
                lng: 5.5,
                lat: 51.5,
            },
            ele: 321.0,
            time: Some(1_700_000_000_000),
            name: Some("summit".into()),
            cmt: Some("comment".into()),
            desc: Some("description".into()),
            links: vec![
                link("https://example.com/summit"),
                link("https://example.com/summit-2"),
            ],
            sym: Some("Summit".into()),
            type_: Some("peak".into()),
        }
    }

    /// A file that has a value for every field, with fixed ids.
    fn sample() -> File {
        let mut file = File {
            id: FileId(id(1)),
            info: FileInfo {
                name: "sample".into(),
                desc: Some("about".into()),
                author: Some(Author {
                    name: Some("someone".into()),
                    email: Some("someone@example.com".into()),
                    link: Some(link("https://example.com/someone")),
                }),
                links: vec![
                    link("https://example.com/file"),
                    link("https://example.com/file-2"),
                ],
                time: Some(1_700_000_000_000),
            },
            ..Default::default()
        };
        let mut segment = TrackSegment::default();
        segment.id = TrackSegmentId(id(3));
        segment.push(TrackpointChunk {
            id: TrackpointChunkId(id(4)),
            trkpt: vec![trackpoint(0), trackpoint(1), Trackpoint::default()],
        });
        let mut empty = TrackSegment::default();
        empty.id = TrackSegmentId(id(6));
        file.trk.push(Track {
            id: TrackId(id(2)),
            info: TrackInfo {
                name: Some("track".into()),
                cmt: Some("cmt".into()),
                desc: Some("desc".into()),
                src: Some("src".into()),
                links: vec![
                    link("https://example.com/track"),
                    link("https://example.com/track-2"),
                ],
                type_: Some("Cycling".into()),
                color: Some("ff0000".into()),
                opacity: Some(0.5),
                width: Some(6.0),
            },
            trkseg: vec![segment, empty],
        });
        file.wpt.push(WaypointChunk {
            id: WaypointChunkId(id(5)),
            wpt: vec![
                waypoint(),
                Waypoint {
                    id: crate::WaypointId(id(8)),
                    ..Default::default()
                },
            ],
        });
        file
    }

    fn categories() -> TrackpointCategories {
        let mut categories = TrackpointCategories::default();
        categories.surface.code("asphalt");
        categories.surface.code("gravel");
        categories.highway.code("path");
        categories.sac_scale.code("hiking");
        categories.mtb_scale.code("mtb0");
        categories
    }

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    fn unhex(text: &str) -> Vec<u8> {
        (0..text.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
            .collect()
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

    fn rebuilt(file: &File, record: FileRecord) -> Option<File> {
        let (trackpoints, waypoints) = chunks_of(file);
        record.build(file.id, &|id| trackpoints.get(id).cloned(), &|id| {
            waypoints.get(id).cloned()
        })
    }

    fn assert_same_file(a: &File, b: &File) {
        assert_eq!(a.id, b.id);
        assert_eq!(a.info, b.info);
        assert_eq!(a.trk.len(), b.trk.len());
        for (a, b) in a.trk.iter().zip(&b.trk) {
            assert_eq!((a.id, &a.info), (b.id, &b.info));
            assert_eq!(a.trkseg.len(), b.trkseg.len());
            for (a, b) in a.trkseg.iter().zip(&b.trkseg) {
                assert_eq!(a.id, b.id);
                assert_eq!(a.len(), b.len());
                for (a, b) in a.chunks().iter().zip(b.chunks()) {
                    assert!(Rc::ptr_eq(a, b), "the chunks are the ones that were given");
                }
            }
        }
        assert_eq!(a.wpt.len(), b.wpt.len());
        for (a, b) in a.wpt.chunks().iter().zip(b.wpt.chunks()) {
            assert!(Rc::ptr_eq(a, b));
        }
    }

    #[test]
    fn test_a_file_record_rebuilds_the_file_with_the_same_chunks() {
        let file = sample();
        let record = decode_file(&encode_file(&file)).unwrap();
        assert_same_file(&rebuilt(&file, record).unwrap(), &file);
    }

    #[test]
    fn test_a_file_record_of_a_missing_chunk_builds_nothing() {
        let file = sample();
        let (trackpoints, waypoints) = chunks_of(&file);
        let record = || decode_file(&encode_file(&file)).unwrap();
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
    fn test_a_file_without_data_builds_an_empty_file() {
        let file = File::default();
        let built = decode_file(&encode_file(&file))
            .unwrap()
            .build(file.id, &|_| None, &|_| None)
            .unwrap();
        assert!(built.trk.is_empty() && built.wpt.is_empty());
    }

    /// The names of the categories of a trackpoint.
    fn names(point: &Trackpoint, categories: &TrackpointCategories) -> [Option<String>; 4] {
        let name = |table: &crate::Categories, code: Option<u8>| {
            code.and_then(|code| table.name(code)).map(str::to_owned)
        };
        [
            name(&categories.surface, point.surface),
            name(&categories.highway, point.highway),
            name(&categories.sac_scale, point.sac_scale),
            name(&categories.mtb_scale, point.mtb_scale),
        ]
    }

    #[test]
    fn test_chunks_keep_their_identity_and_items() {
        let chunk = &sample().trk[0].trkseg[0].chunks()[0].clone();
        let categories = categories();
        let mut reader = categories.clone();
        let decoded = decode_trackpoints(
            chunk.id.0,
            &encode_trackpoints(chunk, &categories),
            &mut reader,
        )
        .unwrap();
        assert_eq!(decoded.id, chunk.id);
        assert_eq!(decoded.trkpt.len(), 3);
        // read by an engine that has the same table, the trackpoints are the same
        assert_eq!(reader, categories);
        for (a, b) in decoded.trkpt.iter().zip(&chunk.trkpt) {
            assert_eq!(format!("{a:?}"), format!("{b:?}"));
        }

        let chunk = &sample().wpt.chunks()[0].clone();
        let decoded = decode_waypoints(chunk.id.0, &encode_waypoints(chunk)).unwrap();
        assert_eq!(decoded.id, chunk.id);
        for (a, b) in decoded.wpt.iter().zip(&chunk.wpt) {
            assert_eq!(a.id, b.id);
            assert!(a.same_content(b));
        }
    }

    #[test]
    fn test_a_chunk_means_the_same_to_an_engine_with_another_table() {
        let chunk = &sample().trk[0].trkseg[0].chunks()[0].clone();
        let writer = categories();
        let bytes = encode_trackpoints(chunk, &writer);

        // an engine that learned other names first, and the same ones in another order
        let mut reader = TrackpointCategories::default();
        reader.surface.code("sand");
        reader.surface.code("gravel");
        reader.surface.code("asphalt");
        reader.highway.code("track");
        let decoded = decode_trackpoints(chunk.id.0, &bytes, &mut reader).unwrap();

        for (read, written) in decoded.trkpt.iter().zip(&chunk.trkpt) {
            assert_eq!(names(read, &reader), names(written, &writer));
        }
        // the codes are the ones of the reader, which learned what it did not know
        assert_eq!(decoded.trkpt[0].surface, Some(1));
        assert_eq!(decoded.trkpt[1].surface, Some(2));
        assert_eq!(reader.highway.names(), ["track", "path"]);
        assert_eq!(decoded.trkpt[0].highway, Some(1));
        assert_eq!(reader.sac_scale.names(), ["hiking"]);
        // and an empty engine learns them in the order they come
        let mut empty = TrackpointCategories::default();
        decode_trackpoints(chunk.id.0, &bytes, &mut empty).unwrap();
        assert_eq!(empty.surface.names(), ["gravel", "asphalt"]);
    }

    #[test]
    fn test_a_chunk_only_carries_the_names_it_uses() {
        let mut writer = TrackpointCategories::default();
        for i in 0..10 {
            writer.surface.code(&format!("surface-{i}"));
        }
        let mut chunk = sample().trk[0].trkseg[0].chunks()[0].trkpt.clone();
        chunk.iter_mut().for_each(|p| p.surface = Some(7));
        let chunk = TrackpointChunk::new(chunk);
        let bytes = encode_trackpoints(&chunk, &writer);

        let mut reader = TrackpointCategories::default();
        let decoded = decode_trackpoints(chunk.id.0, &bytes, &mut reader).unwrap();
        assert_eq!(reader.surface.names(), ["surface-7"]);
        assert!(decoded.trkpt.iter().all(|p| p.surface == Some(0)));
    }

    #[test]
    fn test_codes_without_a_name_are_not_stored_and_names_without_room_are_lost() {
        let mut writer = categories();
        let mut chunk = sample().trk[0].trkseg[0].chunks()[0].trkpt.clone();
        // a code that the table does not know
        chunk[1].surface = Some(200);
        let chunk = TrackpointChunk::new(chunk);
        let bytes = encode_trackpoints(&chunk, &writer);
        let decoded =
            decode_trackpoints(chunk.id.0, &bytes, &mut TrackpointCategories::default()).unwrap();
        assert_eq!(decoded.trkpt[1].surface, None);
        assert_eq!(decoded.trkpt[0].surface, Some(0));

        // an engine whose table is full keeps the names it has and loses the other ones
        let mut full = TrackpointCategories::default();
        for i in 0..crate::Categories::CAPACITY {
            full.surface.code(&format!("other-{i}"));
        }
        writer.surface.code("other-3");
        let mut chunk = chunk.trkpt.clone();
        chunk[0].surface = writer.surface.code("other-3");
        chunk[1].surface = writer.surface.code("gravel");
        let chunk = TrackpointChunk::new(chunk);
        let decoded =
            decode_trackpoints(chunk.id.0, &encode_trackpoints(&chunk, &writer), &mut full)
                .unwrap();
        assert_eq!(decoded.trkpt[0].surface, Some(3));
        assert_eq!(decoded.trkpt[1].surface, None);
    }

    #[test]
    fn test_chunks_read_one_after_the_other_share_the_table() {
        let writer = categories();
        let chunk = sample().trk[0].trkseg[0].chunks()[0].clone();
        let bytes = encode_trackpoints(&chunk, &writer);
        let mut reader = TrackpointCategories::default();
        let a = decode_trackpoints(id(1), &bytes, &mut reader).unwrap();
        let b = decode_trackpoints(id(2), &bytes, &mut reader).unwrap();
        for (a, b) in a.trkpt.iter().zip(&b.trkpt) {
            assert_eq!((a.surface, a.highway), (b.surface, b.highway));
        }
        assert_eq!(reader.surface.names().len(), 2);
    }

    #[test]
    fn test_order_round_trips() {
        let order = vec![FileId(id(9)), FileId(id(8))];
        assert_eq!(decode_order(&encode_order(&order)).unwrap(), order);
    }

    #[test]
    fn test_blobs_say_their_version_and_unknown_ones_are_told_apart_from_corrupt_ones() {
        assert_eq!(encode_file(&sample())[0], LATEST);
        assert_eq!(encode_order(&[])[0], LATEST);

        let mut bytes = encode_order(&[FileId(id(1))]);
        bytes[0] = LATEST + 1;
        assert_eq!(
            decode_order(&bytes),
            Err(DecodeError::UnknownVersion(LATEST + 1))
        );
        assert_eq!(decode_order(&[0]), Err(DecodeError::UnknownVersion(0)));
        assert!(matches!(
            decode_file(&bytes),
            Err(DecodeError::UnknownVersion(_))
        ));
        assert!(matches!(
            decode_trackpoints(id(1), &bytes, &mut Default::default()),
            Err(DecodeError::UnknownVersion(_))
        ));
        assert!(matches!(
            decode_waypoints(id(1), &bytes),
            Err(DecodeError::UnknownVersion(_))
        ));

        // nothing at all, or a known version with something else
        assert_eq!(decode_order(&[]), Err(DecodeError::Corrupt));
        assert_eq!(
            decode_file(&[LATEST, 0xff, 0xff]).err(),
            Some(DecodeError::Corrupt)
        );
        assert_eq!(
            decode_trackpoints(id(1), &[LATEST, 9, 9, 9], &mut Default::default()).err(),
            Some(DecodeError::Corrupt)
        );
    }

    // The stored forms of version 1, as they were written when the version was made. They must
    // stay readable, whatever happens to the engine types: if a test below fails, the form was
    // changed by mistake, or a version was not added when it should have been.
    const FILE_V1: &str = concat!(
        "010673616d706c65010561626f7574010107736f6d656f6e650113736f6d656f6e65406578616d706c652e63",
        "6f6d011b68747470733a2f2f6578616d706c652e636f6d2f736f6d656f6e65012374657874206f6620687474",
        "70733a2f2f6578616d706c652e636f6d2f736f6d656f6e65021868747470733a2f2f6578616d706c652e636f",
        "6d2f66696c65012074657874206f662068747470733a2f2f6578616d706c652e636f6d2f66696c651a687474",
        "70733a2f2f6578616d706c652e636f6d2f66696c652d32012274657874206f662068747470733a2f2f657861",
        "6d706c652e636f6d2f66696c652d320180a0abfef96201100000000000000000000000000000000201057472",
        "61636b0103636d740104646573630103737263021968747470733a2f2f6578616d706c652e636f6d2f747261",
        "636b012174657874206f662068747470733a2f2f6578616d706c652e636f6d2f747261636b1b68747470733a",
        "2f2f6578616d706c652e636f6d2f747261636b2d32012374657874206f662068747470733a2f2f6578616d70",
        "6c652e636f6d2f747261636b2d3201074379636c696e67010666663030303001000000000000e03f01000000",
        "0000001840021000000000000000000000000000000003011000000000000000000000000000000004100000",
        "000000000000000000000000000600011000000000000000000000000000000005",
    );
    const TRACKPOINTS_V1: &str = concat!(
        "01020667726176656c0761737068616c74010470617468010668696b696e6701046d74623003000000000000",
        "1040000000000000494000000000002059400180a0abfef9620105018c01015001fa01010001000100010001",
        "000000000000001440000000000080494000000000006059400182a0abfef9620105018d01015001fa010101",
        "010001000100010100000000000000000000000000000000000000000000000000000000000000000000",
    );
    const WAYPOINTS_V1: &str = concat!(
        "0102100000000000000000000000000000000700000000000016400000000000c04940000000000010744001",
        "80a0abfef962010673756d6d69740107636f6d6d656e74010b6465736372697074696f6e021a68747470733a",
        "2f2f6578616d706c652e636f6d2f73756d6d6974012274657874206f662068747470733a2f2f6578616d706c",
        "652e636f6d2f73756d6d69741c68747470733a2f2f6578616d706c652e636f6d2f73756d6d69742d32012474",
        "657874206f662068747470733a2f2f6578616d706c652e636f6d2f73756d6d69742d32010653756d6d697401",
        "047065616b100000000000000000000000000000000800000000000000000000000000000000000000000000",
        "000000000000000000",
    );
    const ORDER_V1: &str =
        "010210000000000000000000000000000000091000000000000000000000000000000008";

    #[test]
    fn test_version_1_is_still_written_as_it_was() {
        let file = sample();
        assert_eq!(hex(&encode_file(&file)), FILE_V1);
        assert_eq!(
            hex(&encode_trackpoints(
                &file.trk[0].trkseg[0].chunks()[0],
                &categories()
            )),
            TRACKPOINTS_V1
        );
        assert_eq!(hex(&encode_waypoints(&file.wpt.chunks()[0])), WAYPOINTS_V1);
        assert_eq!(
            hex(&encode_order(&[FileId(id(9)), FileId(id(8))])),
            ORDER_V1
        );
    }

    #[test]
    fn test_version_1_is_still_read_as_it_was() {
        let file = sample();
        assert_same_file(
            &rebuilt(&file, decode_file(&unhex(FILE_V1)).unwrap()).unwrap(),
            &file,
        );
        let mut reader = TrackpointCategories::default();
        let chunk = decode_trackpoints(id(4), &unhex(TRACKPOINTS_V1), &mut reader).unwrap();
        let expected = &file.trk[0].trkseg[0].chunks()[0];
        assert_eq!(chunk.trkpt.len(), expected.trkpt.len());
        for (read, written) in chunk.trkpt.iter().zip(&expected.trkpt) {
            assert_eq!(names(read, &reader), names(written, &categories()));
            assert_eq!(read.hr, written.hr);
            assert_eq!(read.anchor, written.anchor);
        }
        let chunk = decode_waypoints(id(5), &unhex(WAYPOINTS_V1)).unwrap();
        assert_eq!(chunk.wpt.len(), 2);
        assert!(chunk.wpt[0].same_content(&waypoint()));
        assert_eq!(chunk.wpt[0].id, waypoint().id);
        assert_eq!(
            decode_order(&unhex(ORDER_V1)).unwrap(),
            vec![FileId(id(9)), FileId(id(8))]
        );
    }
}
