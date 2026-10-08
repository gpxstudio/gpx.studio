use std::{collections::HashSet, rc::Rc};

use crate::{
    Apply, CommandError, Edit, Editor, File, FileId, LngLat, LngLatBounds, Selection, State,
    TrackSegment, TrackSegmentId, Trackpoint, Waypoint, delete_waypoints, update_selected,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanType {
    Inside,
    Outside,
}

/// Removes the trackpoints and/or waypoints of the selection lying inside (or outside) a
/// rectangle. A selected file cleans its tracks and its waypoints, a selected track or segment
/// only trackpoints, selected waypoints only waypoints.
#[derive(Debug)]
pub struct Clean {
    pub bounds: LngLatBounds,
    pub type_: CleanType,
    pub trkpt: bool,
    pub wpt: bool,
}

impl Clean {
    fn contains(&self, c: LngLat) -> bool {
        (self.bounds.sw.lng..=self.bounds.ne.lng).contains(&c.lng)
            && (self.bounds.sw.lat..=self.bounds.ne.lat).contains(&c.lat)
    }

    fn removes(&self, c: LngLat) -> bool {
        self.contains(c) == (self.type_ == CleanType::Inside)
    }
}

impl Apply for Clean {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        match &*state.selection {
            Selection::Waypoint { file_id, .. } | Selection::Waypoints { file_id } => {
                let file_id = *file_id;
                if !self.wpt {
                    return Err(CommandError::NothingToDo);
                }
                let wpt_ids = match &*state.selection {
                    Selection::Waypoint { wpt_ids, .. } => Some(wpt_ids.clone()),
                    _ => None,
                };
                let selected =
                    |wpt: &Waypoint| wpt_ids.as_ref().is_none_or(|ids| ids.contains(&wpt.id));
                *state.selection = delete_waypoints(state.files, file_id, |wpt| {
                    selected(wpt) && self.removes(wpt.coordinates)
                })?;
                Ok(())
            }
            Selection::Empty => Err(CommandError::NothingToDo),
            _ => {
                let mut cleaner = Cleaner {
                    clean: &self,
                    changed: false,
                    emptied: HashSet::new(),
                    wpt_files: HashSet::new(),
                };
                update_selected(state, &mut cleaner);
                if cleaner.changed {
                    prune(state, &cleaner.emptied, &cleaner.wpt_files);
                    Ok(())
                } else {
                    Err(CommandError::NothingToDo)
                }
            }
        }
    }
}

struct Cleaner<'a> {
    clean: &'a Clean,
    changed: bool,
    /// Segments left without trackpoints by the clean.
    emptied: HashSet<TrackSegmentId>,
    /// Files that lost waypoints.
    wpt_files: HashSet<FileId>,
}

impl Editor for Cleaner<'_> {
    fn file(&mut self, file: &mut File) -> Edit {
        let mut edit = Edit::Unchanged;
        for trk in &mut file.trk {
            if self.track(trk) == Edit::Changed {
                edit = Edit::Changed;
            }
        }
        if self.clean.wpt
            && file.wpt.edit(
                |wpt| self.clean.removes(wpt.coordinates),
                |wpts| {
                    wpts.retain(|wpt| !self.clean.removes(wpt.coordinates));
                    true
                },
            )
        {
            edit = Edit::Changed;
            self.wpt_files.insert(file.id);
        }
        self.changed |= edit == Edit::Changed;
        edit
    }

    fn segment(&mut self, segment: &mut TrackSegment) -> Edit {
        if !self.clean.trkpt || !segment.iter().any(|pt| self.clean.removes(pt.coordinates)) {
            return Edit::Unchanged;
        }
        let kept: Vec<Trackpoint> = segment
            .iter()
            .filter(|pt| !self.clean.removes(pt.coordinates))
            .cloned()
            .collect();
        if kept.is_empty() {
            self.emptied.insert(segment.id);
        }
        segment.splice(0, segment.len(), kept);
        self.changed = true;
        Edit::Changed
    }
}

/// Removes what the clean left empty: the emptied segments, the tracks that lost all their
/// segments and the files that lost something and have nothing left. The selection falls back
/// to the closest element still existing.
fn prune(state: &mut State, emptied: &HashSet<TrackSegmentId>, wpt_files: &HashSet<FileId>) {
    let ids: Vec<FileId> = state
        .files
        .iter()
        .filter(|(id, file)| {
            wpt_files.contains(id)
                || file
                    .trk
                    .iter()
                    .any(|trk| trk.trkseg.iter().any(|seg| emptied.contains(&seg.id)))
        })
        .map(|(id, _)| *id)
        .collect();
    for id in ids {
        let mut file = (*state.files[&id]).clone();
        let lost_something = !emptied.is_empty() || wpt_files.contains(&id);
        file.trk.retain_mut(|trk| {
            let len = trk.trkseg.len();
            trk.trkseg.retain(|seg| !emptied.contains(&seg.id));
            trk.trkseg.len() == len || !trk.trkseg.is_empty()
        });
        if lost_something && file.trk.is_empty() && file.wpt.is_empty() {
            state.files.remove(&id);
            state.order.0.retain(|f| *f != id);
        } else {
            state.files.insert(id, Rc::new(file));
        }
    }
    *state.selection = fixed_selection(state);
}

fn fixed_selection(state: &State) -> Selection {
    let files = &*state.files;
    match &*state.selection {
        Selection::File { file_ids } => {
            let file_ids: HashSet<_> = file_ids
                .iter()
                .filter(|id| files.contains_key(id))
                .copied()
                .collect();
            if file_ids.is_empty() {
                Selection::Empty
            } else {
                Selection::File { file_ids }
            }
        }
        Selection::Track { file_id, trk_ids } => {
            let Some(file) = files.get(file_id) else {
                return Selection::Empty;
            };
            let trk_ids: HashSet<_> = file
                .trk
                .iter()
                .map(|trk| trk.id)
                .filter(|id| trk_ids.contains(id))
                .collect();
            if trk_ids.is_empty() {
                Selection::File {
                    file_ids: [*file_id].into(),
                }
            } else {
                Selection::Track {
                    file_id: *file_id,
                    trk_ids,
                }
            }
        }
        Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            let Some(file) = files.get(file_id) else {
                return Selection::Empty;
            };
            let Some(trk) = file.trk.iter().find(|trk| trk.id == *trk_id) else {
                return Selection::File {
                    file_ids: [*file_id].into(),
                };
            };
            let trkseg_ids: HashSet<_> = trk
                .trkseg
                .iter()
                .map(|seg| seg.id)
                .filter(|id| trkseg_ids.contains(id))
                .collect();
            if trkseg_ids.is_empty() {
                Selection::Track {
                    file_id: *file_id,
                    trk_ids: [*trk_id].into(),
                }
            } else {
                Selection::TrackSegment {
                    file_id: *file_id,
                    trk_id: *trk_id,
                    trkseg_ids,
                }
            }
        }
        Selection::Waypoints { file_id } | Selection::Waypoint { file_id, .. } => {
            if files.contains_key(file_id) {
                Selection::File {
                    file_ids: [*file_id].into(),
                }
            } else {
                Selection::Empty
            }
        }
        Selection::Empty => Selection::Empty,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, WaypointChunk, Waypoints, engine::command::fixture::Fixture};

    use super::*;

    fn loaded() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = fx.order.0[0];
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        (fx, id)
    }

    fn bounds(w: f64, s: f64, e: f64, n: f64) -> LngLatBounds {
        LngLatBounds {
            sw: LngLat { lng: w, lat: s },
            ne: LngLat { lng: e, lat: n },
        }
    }

    fn clean(bounds: LngLatBounds, type_: CleanType) -> Clean {
        Clean {
            bounds,
            type_,
            trkpt: true,
            wpt: true,
        }
    }

    fn count(fx: &Fixture, id: FileId) -> usize {
        fx.files
            .get(&id)
            .into_iter()
            .flat_map(|file| &file.trk)
            .flat_map(|trk| &trk.trkseg)
            .map(|seg| seg.len())
            .sum()
    }

    #[test]
    fn test_inside_everything_removes_all_trackpoints() {
        let (mut fx, id) = loaded();
        assert!(count(&fx, id) > 0);
        clean(bounds(-180.0, -90.0, 180.0, 90.0), CleanType::Inside)
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(count(&fx, id), 0);
        // nothing is left of the file
        assert!(!fx.files.contains_key(&id));
        assert!(fx.order.0.is_empty());
        assert_eq!(fx.selection, Selection::Empty);
    }

    #[test]
    fn test_emptied_segments_and_tracks_are_removed() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let seg = &before.trk[0].trkseg[0];
        let pts: Vec<_> = seg.iter().map(|p| p.coordinates).collect();
        let mut b = LngLatBounds::default();
        pts.iter().for_each(|c| b.extend(*c));
        clean(b, CleanType::Inside).apply(&mut fx.state()).unwrap();
        let after = &fx.files[&id];
        assert!(after.trk.iter().all(|t| !t.trkseg.is_empty()));
        assert!(
            after
                .trk
                .iter()
                .flat_map(|t| &t.trkseg)
                .all(|s| !s.is_empty())
        );
    }

    #[test]
    fn test_outside_everything_changes_nothing() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let result =
            clean(bounds(-180.0, -90.0, 180.0, 90.0), CleanType::Outside).apply(&mut fx.state());
        assert!(matches!(result, Err(CommandError::NothingToDo)));
        // the file was not even copied
        assert!(std::rc::Rc::ptr_eq(&fx.files[&id], &before));
    }

    #[test]
    fn test_partial_clean_only_removes_points_inside_and_bumps_revision() {
        let (mut fx, id) = loaded();
        let before = fx.files[&id].clone();
        let first = before.trk[0].trkseg[0].iter().next().unwrap().coordinates;
        let total = count(&fx, id);
        // tiny rectangle around the first point
        let b = bounds(
            first.lng - 1e-9,
            first.lat - 1e-9,
            first.lng + 1e-9,
            first.lat + 1e-9,
        );
        clean(b, CleanType::Inside).apply(&mut fx.state()).unwrap();
        let removed = total - count(&fx, id);
        assert!(removed >= 1);
        let seg = &fx.files[&id].trk[0].trkseg[0];
        assert_ne!(seg.rev_id, before.trk[0].trkseg[0].rev_id);
        assert!(seg.iter().all(|pt| !b_contains(&b, pt.coordinates)));
    }

    fn b_contains(b: &LngLatBounds, c: LngLat) -> bool {
        c.lng >= b.sw.lng && c.lng <= b.ne.lng && c.lat >= b.sw.lat && c.lat <= b.ne.lat
    }

    #[test]
    fn test_waypoints_flag_and_selection() {
        let (mut fx, id) = loaded();
        let mut file = (*fx.files[&id]).clone();
        file.wpt = Waypoints::new([WaypointChunk {
            wpt: vec![Waypoint::default(), Waypoint::default()],
            ..Default::default()
        }]);
        let ids: Vec<_> = file.wpt.iter().map(|w| w.id).collect();
        fx.files.insert(id, std::rc::Rc::new(file));
        let everywhere = bounds(-180.0, -90.0, 180.0, 90.0);
        let wpt_count = |fx: &Fixture| fx.files.get(&id).map_or(0, |f| f.wpt.len());

        // trackpoints only: waypoints are kept
        Clean {
            wpt: false,
            ..clean(everywhere, CleanType::Inside)
        }
        .apply(&mut fx.state())
        .unwrap();
        assert_eq!(wpt_count(&fx), 2);

        // one selected waypoint
        fx.selection = Selection::Waypoint {
            file_id: id,
            wpt_ids: HashSet::from([ids[0]]),
        };
        clean(everywhere, CleanType::Inside)
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(wpt_count(&fx), 1);

        // whole file
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        clean(everywhere, CleanType::Inside)
            .apply(&mut fx.state())
            .unwrap();
        assert_eq!(wpt_count(&fx), 0);
    }
}
