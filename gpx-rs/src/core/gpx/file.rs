use crate::{Link, Route, Track, TrackSegment, Waypoints};

use super::common::uuid_id;

uuid_id!(FileId);

#[derive(Debug, Default, Clone)]
pub struct File {
    pub id: FileId,
    pub info: FileInfo,
    /// The routes come before the tracks, as in GPX: everything that goes through the segments
    /// of a file (statistics, the elevation profile...) takes the ones of the routes first.
    pub rte: Vec<Route>,
    pub trk: Vec<Track>,
    pub wpt: Waypoints,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct FileInfo {
    pub name: String,
    pub desc: Option<String>,
    pub author: Option<Author>,
    pub links: Vec<Link>,
    pub time: Option<i64>,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Author {
    pub name: Option<String>,
    /// `id@domain`, which the file gives as the two attributes of an `email` element.
    pub email: Option<String>,
    /// The author has a single link, unlike the other elements.
    pub link: Option<Link>,
}

/// Where a segment is in its file: the one of a route, or one of a track.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentIndex {
    Route(usize),
    Track { trk: usize, seg: usize },
}

impl File {
    /// The segments of the routes, then the ones of the tracks.
    pub fn segments(&self) -> impl Iterator<Item = &TrackSegment> {
        self.rte
            .iter()
            .map(|rte| &rte.seg)
            .chain(self.trk.iter().flat_map(|trk| &trk.trkseg))
    }

    /// Where the segments are, in the order of [`File::segments`].
    pub fn segment_indices(&self) -> impl Iterator<Item = SegmentIndex> + '_ {
        (0..self.rte.len())
            .map(SegmentIndex::Route)
            .chain(self.trk.iter().enumerate().flat_map(|(trk, track)| {
                (0..track.trkseg.len()).map(move |seg| SegmentIndex::Track { trk, seg })
            }))
    }

    /// The segment at `index`. Panics if there is none.
    pub fn segment(&self, index: SegmentIndex) -> &TrackSegment {
        match index {
            SegmentIndex::Route(rte) => &self.rte[rte].seg,
            SegmentIndex::Track { trk, seg } => &self.trk[trk].trkseg[seg],
        }
    }

    /// The segment at `index`. Panics if there is none.
    pub fn segment_mut(&mut self, index: SegmentIndex) -> &mut TrackSegment {
        match index {
            SegmentIndex::Route(rte) => &mut self.rte[rte].seg,
            SegmentIndex::Track { trk, seg } => &mut self.trk[trk].trkseg[seg],
        }
    }

    /// Whether the file has no route nor track.
    pub fn has_no_path(&self) -> bool {
        self.rte.is_empty() && self.trk.is_empty()
    }
}
