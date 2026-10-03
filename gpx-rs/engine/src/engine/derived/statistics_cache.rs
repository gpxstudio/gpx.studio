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
                Selection::File { file_ids } => {
                    for id in file_ids.iter() {
                        if let Some(file) = state.get(id) {
                            self.add_file_stats(file, &mut stats);
                        }
                    }
                }
                Selection::Track { file_id, trk_ids } => {
                    if let Some(file) = state.get(file_id) {
                        for trk in file.trk.iter() {
                            if trk_ids.contains(&trk.id) {
                                self.add_track_stats(trk, &mut stats);
                            }
                        }
                    }
                }
                Selection::TrackSegment {
                    file_id,
                    trk_id,
                    trkseg_ids,
                } => {
                    if let Some(file) = state.get(file_id) {
                        for trk in file.trk.iter() {
                            if *trk_id == trk.id {
                                for trkseg in trk.trkseg.iter() {
                                    if trkseg_ids.contains(&trkseg.id) {
                                        self.add_segment_stats(trkseg, &mut stats);
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                Selection::Waypoints { file_id } => {
                    if let Some(file) = state.get(file_id) {
                        self.add_file_stats(file, &mut stats);
                    }
                }
                Selection::Waypoint {
                    file_id,
                    wpt_ids: _,
                } => {
                    if let Some(file) = state.get(file_id) {
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

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, parse};

    use super::*;

    fn state(path: &str) -> (StackEntry, Rc<File>) {
        let data = std::fs::read(path).unwrap();
        let file = Rc::new(parse(&data).unwrap());
        let mut state = StackEntry::default();
        state.insert(file.id, file.clone());
        (state, file)
    }

    fn file_selection(id: FileId) -> Selection {
        Selection::File {
            file_ids: HashSet::from([id]),
        }
    }

    #[test]
    fn test_update_and_select_file() {
        let (state, file) = state("data/with_tracks_and_segments.gpx");
        let nb_segments: usize = file.trk.iter().map(|t| t.trkseg.len()).sum();
        let mut cache = StatisticsCache::default();
        cache.update(Some(&state));
        assert_eq!(cache.map.len(), nb_segments);

        assert_eq!(
            cache.get(Some(&state), &file_selection(file.id)).len(),
            nb_segments
        );
        assert!(cache.get(Some(&state), &Selection::Empty).is_empty());
        assert!(cache.get(None, &file_selection(file.id)).is_empty());
        // unknown file
        assert!(
            cache
                .get(Some(&state), &file_selection(FileId::default()))
                .is_empty()
        );
    }

    #[test]
    fn test_select_track_and_segment() {
        let (state, file) = state("data/with_tracks_and_segments.gpx");
        let mut cache = StatisticsCache::default();
        cache.update(Some(&state));

        let trk = &file.trk[0];
        let selection = Selection::Track {
            file_id: file.id,
            trk_ids: HashSet::from([trk.id]),
        };
        assert_eq!(cache.get(Some(&state), &selection).len(), trk.trkseg.len());

        let trkseg = &trk.trkseg[1];
        let selection = Selection::TrackSegment {
            file_id: file.id,
            trk_id: trk.id,
            trkseg_ids: HashSet::from([trkseg.id]),
        };
        let stats = cache.get(Some(&state), &selection);
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].local.len(), trkseg.len());

        // a segment id under the wrong track selects nothing
        let selection = Selection::TrackSegment {
            file_id: file.id,
            trk_id: file.trk[1].id,
            trkseg_ids: HashSet::from([trkseg.id]),
        };
        assert!(cache.get(Some(&state), &selection).is_empty());
    }

    #[test]
    fn test_unchanged_segments_are_not_recomputed() {
        let (state, file) = state("data/simple.gpx");
        let mut cache = StatisticsCache::default();
        cache.update(Some(&state));
        let before: *const Statistics = cache.get(Some(&state), &file_selection(file.id))[0];

        // a new snapshot of the file that shares its segments (same revision ids)
        let mut next = StackEntry::default();
        let renamed = {
            let mut f = (*file).clone();
            f.info.name = "other".to_string();
            Rc::new(f)
        };
        next.insert(renamed.id, renamed);
        cache.update(Some(&next));
        let after: *const Statistics = cache.get(Some(&next), &file_selection(file.id))[0];
        assert!(std::ptr::eq(before, after));
    }

    #[test]
    fn test_modified_segment_is_recomputed_and_stale_entries_dropped() {
        let (state, file) = state("data/simple.gpx");
        let mut cache = StatisticsCache::default();
        cache.update(Some(&state));
        let old_rev = file.trk[0].trkseg[0].rev_id;
        assert!(cache.map.contains_key(&old_rev));

        let mut f = (*file).clone();
        f.trk[0].trkseg[0].rev_id = Default::default();
        let new_rev = f.trk[0].trkseg[0].rev_id;
        let mut next = StackEntry::default();
        next.insert(f.id, Rc::new(f));
        cache.update(Some(&next));
        assert!(cache.map.contains_key(&new_rev));
        assert!(!cache.map.contains_key(&old_rev));

        cache.update(None);
        assert!(cache.map.is_empty());
    }
}
