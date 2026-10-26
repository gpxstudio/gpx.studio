use std::{collections::HashSet, rc::Rc};

use crate::{Apply, CommandError, FileId, Route, Selection, State, Track};

/// Converts the selected routes to tracks, or the selected tracks or segments to routes, in their
/// file:
///
/// - a route becomes a track with its segment. The new tracks go before the other tracks, right
///   after the routes;
/// - a track becomes one route per segment, as a route has a single segment, and goes away. A
///   selected segment becomes a route and leaves its track, which stays even if it has no segment
///   left. The routes have the information of their track, and go after the other routes.
///
/// The segments keep their ids, the new routes and tracks are selected. There is nothing to do
/// for the other selections, or for tracks without segments.
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
                let tracks: Vec<Track> = converted
                    .into_iter()
                    .map(|rte| Track {
                        id: Default::default(),
                        info: rte.info,
                        trkseg: vec![rte.seg],
                    })
                    .collect();
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
                let routes = converted.into_iter().flat_map(|trk| {
                    trk.trkseg.into_iter().map(move |seg| Route {
                        id: Default::default(),
                        info: trk.info.clone(),
                        seg,
                    })
                });
                add_routes(&mut file.rte, *file_id, routes)
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
            Selection::Empty
            | Selection::File { .. }
            | Selection::Waypoints { .. }
            | Selection::Waypoint { .. } => return Err(CommandError::NothingToDo),
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
