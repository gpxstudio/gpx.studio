//! Version 1 of the stored form. It is frozen: the engine types may change, these may not (a test
//! compares the bytes they give with the ones of a fixture). A change of the form is a new
//! version, next to this one, that the decoders convert from.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    Author, Categories, File, FileInfo, Link, LngLat, TrackInfo, Trackpoint, TrackpointCategories,
    Waypoint, WaypointId,
};

#[derive(Serialize, Deserialize)]
pub struct Link1 {
    href: String,
    text: Option<String>,
}

impl From<&Link> for Link1 {
    fn from(link: &Link) -> Self {
        Self {
            href: link.href.clone(),
            text: link.text.clone(),
        }
    }
}

impl From<Link1> for Link {
    fn from(link: Link1) -> Self {
        Self {
            href: link.href,
            text: link.text,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct Author1 {
    name: Option<String>,
    email: Option<String>,
    link: Option<Link1>,
}

#[derive(Serialize, Deserialize)]
pub struct FileInfo1 {
    name: String,
    desc: Option<String>,
    author: Option<Author1>,
    links: Vec<Link1>,
    time: Option<i64>,
}

impl From<&FileInfo> for FileInfo1 {
    fn from(info: &FileInfo) -> Self {
        Self {
            name: info.name.clone(),
            desc: info.desc.clone(),
            author: info.author.as_ref().map(|author| Author1 {
                name: author.name.clone(),
                email: author.email.clone(),
                link: author.link.as_ref().map(Into::into),
            }),
            links: info.links.iter().map(Into::into).collect(),
            time: info.time,
        }
    }
}

impl From<FileInfo1> for FileInfo {
    fn from(info: FileInfo1) -> Self {
        Self {
            name: info.name,
            desc: info.desc,
            author: info.author.map(|author| Author {
                name: author.name,
                email: author.email,
                link: author.link.map(Into::into),
            }),
            links: info.links.into_iter().map(Into::into).collect(),
            time: info.time,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct TrackInfo1 {
    name: Option<String>,
    cmt: Option<String>,
    desc: Option<String>,
    src: Option<String>,
    links: Vec<Link1>,
    type_: Option<String>,
    color: Option<String>,
    opacity: Option<f64>,
    width: Option<f64>,
}

impl From<&TrackInfo> for TrackInfo1 {
    fn from(info: &TrackInfo) -> Self {
        Self {
            name: info.name.clone(),
            cmt: info.cmt.clone(),
            desc: info.desc.clone(),
            src: info.src.clone(),
            links: info.links.iter().map(Into::into).collect(),
            type_: info.type_.clone(),
            color: info.color.clone(),
            opacity: info.opacity,
            width: info.width,
        }
    }
}

impl From<TrackInfo1> for TrackInfo {
    fn from(info: TrackInfo1) -> Self {
        Self {
            name: info.name,
            cmt: info.cmt,
            desc: info.desc,
            src: info.src,
            links: info.links.into_iter().map(Into::into).collect(),
            type_: info.type_,
            color: info.color,
            opacity: info.opacity,
            width: info.width,
        }
    }
}

/// A file without its trackpoints and waypoints, which are in chunks.
#[derive(Serialize, Deserialize)]
pub struct FileRecord1 {
    pub info: FileInfo1,
    pub tracks: Vec<TrackRecord1>,
    pub waypoints: Vec<Uuid>,
}

#[derive(Serialize, Deserialize)]
pub struct TrackRecord1 {
    pub id: Uuid,
    pub info: TrackInfo1,
    pub segments: Vec<SegmentRecord1>,
}

#[derive(Serialize, Deserialize)]
pub struct SegmentRecord1 {
    pub id: Uuid,
    pub chunks: Vec<Uuid>,
}

impl FileRecord1 {
    pub fn new(file: &File) -> Self {
        Self {
            info: (&file.info).into(),
            tracks: file
                .trk
                .iter()
                .map(|track| TrackRecord1 {
                    id: track.id.0,
                    info: (&track.info).into(),
                    segments: track
                        .trkseg
                        .iter()
                        .map(|segment| SegmentRecord1 {
                            id: segment.id.0,
                            chunks: segment.chunks().iter().map(|chunk| chunk.id.0).collect(),
                        })
                        .collect(),
                })
                .collect(),
            waypoints: file.wpt.chunks().iter().map(|chunk| chunk.id.0).collect(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct Trackpoint1 {
    lng: f64,
    lat: f64,
    ele: f64,
    time: Option<i64>,
    atemp: Option<i16>,
    hr: Option<u16>,
    cad: Option<u16>,
    power: Option<u16>,
    /// The position of the name in the list of the chunk (see [`TrackpointChunk1`]).
    surface: Option<u8>,
    highway: Option<u8>,
    sac_scale: Option<u8>,
    mtb_scale: Option<u8>,
    anchor: Option<u8>,
}

impl From<&Trackpoint> for Trackpoint1 {
    fn from(point: &Trackpoint) -> Self {
        Self {
            lng: point.coordinates.lng,
            lat: point.coordinates.lat,
            ele: point.ele,
            time: point.time,
            atemp: point.atemp,
            hr: point.hr,
            cad: point.cad,
            power: point.power,
            surface: point.surface,
            highway: point.highway,
            sac_scale: point.sac_scale,
            mtb_scale: point.mtb_scale,
            anchor: point.anchor,
        }
    }
}

impl From<Trackpoint1> for Trackpoint {
    fn from(point: Trackpoint1) -> Self {
        Self {
            coordinates: LngLat {
                lng: point.lng,
                lat: point.lat,
            },
            ele: point.ele,
            time: point.time,
            atemp: point.atemp,
            hr: point.hr,
            cad: point.cad,
            power: point.power,
            surface: point.surface,
            highway: point.highway,
            sac_scale: point.sac_scale,
            mtb_scale: point.mtb_scale,
            anchor: point.anchor,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct Waypoint1 {
    id: Uuid,
    lng: f64,
    lat: f64,
    ele: f64,
    time: Option<i64>,
    name: Option<String>,
    cmt: Option<String>,
    desc: Option<String>,
    links: Vec<Link1>,
    sym: Option<String>,
    type_: Option<String>,
}

impl From<&Waypoint> for Waypoint1 {
    fn from(waypoint: &Waypoint) -> Self {
        Self {
            id: waypoint.id.0,
            lng: waypoint.coordinates.lng,
            lat: waypoint.coordinates.lat,
            ele: waypoint.ele,
            time: waypoint.time,
            name: waypoint.name.clone(),
            cmt: waypoint.cmt.clone(),
            desc: waypoint.desc.clone(),
            links: waypoint.links.iter().map(Into::into).collect(),
            sym: waypoint.sym.clone(),
            type_: waypoint.type_.clone(),
        }
    }
}

impl From<Waypoint1> for Waypoint {
    fn from(waypoint: Waypoint1) -> Self {
        Self {
            id: WaypointId(waypoint.id),
            coordinates: LngLat {
                lng: waypoint.lng,
                lat: waypoint.lat,
            },
            ele: waypoint.ele,
            time: waypoint.time,
            name: waypoint.name,
            cmt: waypoint.cmt,
            desc: waypoint.desc,
            links: waypoint.links.into_iter().map(Into::into).collect(),
            sym: waypoint.sym,
            type_: waypoint.type_,
        }
    }
}

/// A chunk of trackpoints. It carries the names its categories refer to: the surface, highway,
/// SAC scale and MTB scale of its trackpoints are the positions of the names in its own lists,
/// which only hold the names it uses. So it means the same whatever the table of categories of
/// the engine that reads it is, and it is not changed by what other chunks learn.
#[derive(Serialize, Deserialize)]
pub struct TrackpointChunk1 {
    surface: Vec<String>,
    highway: Vec<String>,
    sac_scale: Vec<String>,
    mtb_scale: Vec<String>,
    points: Vec<Trackpoint1>,
}

/// The names of a category used by a chunk, with their position in the list of the chunk.
struct LocalNames<'a> {
    table: &'a Categories,
    names: Vec<String>,
    local: HashMap<u8, u8>,
}

impl<'a> LocalNames<'a> {
    fn new(table: &'a Categories) -> Self {
        Self {
            table,
            names: vec![],
            local: HashMap::new(),
        }
    }

    /// The position in the list of the chunk of the name of a code of the table. A code that
    /// has no name has no position.
    fn position(&mut self, code: Option<u8>) -> Option<u8> {
        let code = code?;
        if let Some(position) = self.local.get(&code) {
            return Some(*position);
        }
        let name = self.table.name(code)?;
        let position = u8::try_from(self.names.len()).ok()?;
        self.names.push(name.to_owned());
        self.local.insert(code, position);
        Some(position)
    }
}

/// The codes of the table for the names of a chunk, which are added to it if it does not know
/// them. A name that does not fit in a full table has no code.
fn codes_of(names: &[String], table: &mut Categories) -> Vec<Option<u8>> {
    names.iter().map(|name| table.code(name)).collect()
}

impl TrackpointChunk1 {
    pub fn new(points: &[Trackpoint], categories: &TrackpointCategories) -> Self {
        let mut surface = LocalNames::new(&categories.surface);
        let mut highway = LocalNames::new(&categories.highway);
        let mut sac_scale = LocalNames::new(&categories.sac_scale);
        let mut mtb_scale = LocalNames::new(&categories.mtb_scale);
        let points = points
            .iter()
            .map(|point| {
                let mut stored = Trackpoint1::from(point);
                stored.surface = surface.position(point.surface);
                stored.highway = highway.position(point.highway);
                stored.sac_scale = sac_scale.position(point.sac_scale);
                stored.mtb_scale = mtb_scale.position(point.mtb_scale);
                stored
            })
            .collect();
        Self {
            surface: surface.names,
            highway: highway.names,
            sac_scale: sac_scale.names,
            mtb_scale: mtb_scale.names,
            points,
        }
    }

    /// The trackpoints, with the codes of `categories` for the names of the chunk.
    pub fn into_points(self, categories: &mut TrackpointCategories) -> Vec<Trackpoint> {
        let surface = codes_of(&self.surface, &mut categories.surface);
        let highway = codes_of(&self.highway, &mut categories.highway);
        let sac_scale = codes_of(&self.sac_scale, &mut categories.sac_scale);
        let mtb_scale = codes_of(&self.mtb_scale, &mut categories.mtb_scale);
        let global = |codes: &[Option<u8>], local: Option<u8>| {
            local.and_then(|local| codes.get(usize::from(local)).copied().flatten())
        };
        self.points
            .into_iter()
            .map(|stored| {
                let (s, h, sac, mtb) = (
                    global(&surface, stored.surface),
                    global(&highway, stored.highway),
                    global(&sac_scale, stored.sac_scale),
                    global(&mtb_scale, stored.mtb_scale),
                );
                let mut point = Trackpoint::from(stored);
                point.surface = s;
                point.highway = h;
                point.sac_scale = sac;
                point.mtb_scale = mtb;
                point
            })
            .collect()
    }
}
