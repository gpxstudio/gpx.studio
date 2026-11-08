use std::{collections::HashSet, rc::Rc};

use crate::{Apply, CommandError, FileId, Route, Selection, State, Track};

/// Converts the selected routes to tracks, or the selected tracks or segments to routes, in their
/// file:
///
/// - a route becomes a track with its segment. The new tracks go before the other tracks, right
///   after the routes;
/// - a track becomes one route per segment, as a route has a single segment, and goes away. A
///   selected segment becomes a route and leaves its track, which stays even if it has no segment
///   left. The routes have the information of their track, and go after the other routes;
/// - a file with routes only has all of them converted to tracks, and a file with tracks only
///   has all of them converted to routes. The files with both, or neither, stay as they are.
///
/// The segments keep their ids, the new routes and tracks are selected (the files stay selected).
/// There is nothing to do for the other selections, or for tracks without segments.
#[derive(Debug)]
pub struct Convert;

impl Apply for Convert {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let selection = state.selection.clone();
        let next = match &selection {
            Selection::Route { file_id, rte_ids } => {
                let file = Rc::make_mut(
                    state
                        .files
                        .get_mut(file_id)
                        .ok_or(CommandError::NothingToDo)?,
                );
                let (converted, kept) = std::mem::take(&mut file.rte)
                    .into_iter()
                    .partition::<Vec<_>, _>(|rte| rte_ids.contains(&rte.id));
                file.rte = kept;
                let tracks = to_tracks(converted);
                let trk_ids: HashSet<_> = tracks.iter().map(|trk| trk.id).collect();
                file.trk.splice(0..0, tracks);
                Selection::Track {
                    file_id: *file_id,
                    trk_ids,
                }
            }
            Selection::Track { file_id, trk_ids } => {
                let file = Rc::make_mut(
                    state
                        .files
                        .get_mut(file_id)
                        .ok_or(CommandError::NothingToDo)?,
                );
                let (converted, kept) = std::mem::take(&mut file.trk)
                    .into_iter()
                    .partition::<Vec<_>, _>(|trk| trk_ids.contains(&trk.id));
                file.trk = kept;
                add_routes(&mut file.rte, *file_id, to_routes(converted))
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => {
                let file = Rc::make_mut(
                    state
                        .files
                        .get_mut(file_id)
                        .ok_or(CommandError::NothingToDo)?,
                );
                let trk = file
                    .trk
                    .iter_mut()
                    .find(|trk| trk.id == *trk_id)
                    .ok_or(CommandError::NothingToDo)?;
                let (converted, kept) = std::mem::take(&mut trk.trkseg)
                    .into_iter()
                    .partition::<Vec<_>, _>(|seg| trkseg_ids.contains(&seg.id));
                trk.trkseg = kept;
                let info = trk.info.clone();
                let routes = converted.into_iter().map(|seg| Route {
                    id: Default::default(),
                    info: info.clone(),
                    seg,
                });
                add_routes(&mut file.rte, *file_id, routes)
            }
            Selection::File { file_ids } => {
                let mut converted = false;
                for file_id in file_ids {
                    let Some(file) = state.files.get_mut(file_id) else {
                        continue;
                    };
                    if !file.rte.is_empty() && file.trk.is_empty() {
                        let file = Rc::make_mut(file);
                        file.trk = to_tracks(std::mem::take(&mut file.rte));
                    } else if file.rte.is_empty()
                        && file.trk.iter().any(|trk| !trk.trkseg.is_empty())
                    {
                        let file = Rc::make_mut(file);
                        file.rte = to_routes(std::mem::take(&mut file.trk)).collect();
                    } else {
                        continue;
                    }
                    converted = true;
                }
                return if converted {
                    Ok(())
                } else {
                    Err(CommandError::NothingToDo)
                };
            }
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => {
                return Err(CommandError::NothingToDo);
            }
        };
        let empty = match &next {
            Selection::Route { rte_ids, .. } => rte_ids.is_empty(),
            Selection::Track { trk_ids, .. } => trk_ids.is_empty(),
            _ => true,
        };
        if empty {
            // nothing was converted (the changed copy of the file is dropped)
            return Err(CommandError::NothingToDo);
        }
        *state.selection = next;
        Ok(())
    }
}

/// The tracks of the routes, each with the segment of its route.
fn to_tracks(routes: Vec<Route>) -> Vec<Track> {
    routes
        .into_iter()
        .map(|rte| Track {
            id: Default::default(),
            info: rte.info,
            trkseg: vec![rte.seg],
        })
        .collect()
}

/// The routes of the tracks, one per segment, each with the information of its track.
fn to_routes(tracks: Vec<Track>) -> impl Iterator<Item = Route> {
    tracks.into_iter().flat_map(|trk| {
        trk.trkseg.into_iter().map(move |seg| Route {
            id: Default::default(),
            info: trk.info.clone(),
            seg,
        })
    })
}

/// Adds the routes after the other routes, and gives the selection of them.
fn add_routes(
    rte: &mut Vec<Route>,
    file_id: FileId,
    routes: impl Iterator<Item = Route>,
) -> Selection {
    let start = rte.len();
    rte.extend(routes);
    Selection::Route {
        file_id,
        rte_ids: rte[start..].iter().map(|rte| rte.id).collect(),
    }
}
