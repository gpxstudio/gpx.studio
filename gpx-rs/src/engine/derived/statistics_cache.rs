use std::{
    collections::{HashMap, HashSet, hash_map::Entry},
    rc::Rc,
};

use crate::{File, Selection, StackEntry, Statistics, Track, TrackSegment, TrackSegmentRevisionId};

#[derive(Debug, Default)]
pub struct StatisticsCache {
    map: HashMap<TrackSegmentRevisionId, Statistics>,
}

impl StatisticsCache {
    pub fn update(&mut self, state: Option<&StackEntry>) {
        let mut stale: HashSet<TrackSegmentRevisionId> = self.map.keys().copied().collect();
        if let Some(state) = state {
            for file in state.values() {
                for trk in file.trk.iter() {
                    for trkseg in trk.trkseg.iter() {
                        match self.map.entry(trkseg.rev_id) {
                            Entry::Occupied(_) => {
                                stale.remove(&trkseg.rev_id);
                            }
                            Entry::Vacant(e) => {
                                e.insert(Statistics::compute(trkseg));
                            }
                        }
                    }
                }
            }
        }
        for id in stale.iter() {
            self.map.remove(id);
        }
    }

    pub fn get<'a>(
        &'a self,
        state: Option<&StackEntry>,
        selection: &Selection,
    ) -> Vec<&'a Statistics> {
        let mut stats = vec![];
        if let Some(state) = state {
            match selection {
                Selection::Empty => (),
                Selection::File(s) => {
                    for id in s.files.iter() {
                        if let Some(file) = state.get(id) {
                            self.add_file_stats(file, &mut stats);
                        }
                    }
                }
                Selection::Track(s) => {
                    if let Some(file) = state.get(&s.file) {
                        for trk in file.trk.iter() {
                            if s.trk.contains(&trk.id) {
                                self.add_track_stats(trk, &mut stats);
                            }
                        }
                    }
                }
                Selection::TrackSegment(s) => {
                    if let Some(file) = state.get(&s.file) {
                        for trk in file.trk.iter() {
                            if s.trk == trk.id {
                                for trkseg in trk.trkseg.iter() {
                                    if s.trkseg.contains(&trkseg.id) {
                                        self.add_segment_stats(trkseg, &mut stats);
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                Selection::Waypoints(s) => {
                    if let Some(file) = state.get(&s.file) {
                        self.add_file_stats(file, &mut stats);
                    }
                }
                Selection::Waypoint(s) => {
                    if let Some(file) = state.get(&s.file) {
                        self.add_file_stats(file, &mut stats);
                    }
                }
            }
        }
        stats
    }

    fn add_file_stats<'a>(&'a self, file: &Rc<File>, stats: &mut Vec<&'a Statistics>) {
        for trk in file.trk.iter() {
            self.add_track_stats(trk, stats);
        }
    }

    fn add_track_stats<'a>(&'a self, trk: &Track, stats: &mut Vec<&'a Statistics>) {
        for trkseg in trk.trkseg.iter() {
            self.add_segment_stats(trkseg, stats);
        }
    }

    fn add_segment_stats<'a>(&'a self, trkseg: &TrackSegment, stats: &mut Vec<&'a Statistics>) {
        if let Some(s) = self.map.get(&trkseg.rev_id) {
            stats.push(s);
        }
    }
}
