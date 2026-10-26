//! The commands on routes: they work as on tracks, a route being a track of a single segment.

use std::rc::Rc;

use crate::{
    Apply, Clean, CleanType, Clipboard, ClipboardContent, CommandError, Convert, Crop, Delete,
    Duplicate, Extract, File, FileId, LngLat, LngLatBounds, Merge, MergeType, Metadata, Move,
    MoveTarget, Paste, Reverse, RouteId, SegmentIndex, Selection, Split, SplitType, Style,
    engine::command::fixture::Fixture, parse,
};

/// A file with the 2 routes of `with_routes` and the 2 tracks (of 2 segments) of
/// `with_tracks_and_segments`, which is the only file and is in the order.
fn fixture() -> (Fixture, FileId) {
    let read = |name: &str| {
        let data = std::fs::read(format!("data/{name}.gpx")).unwrap();
        parse(&data, &mut Default::default()).unwrap()
    };
    let mut file = read("with_tracks_and_segments");
    file.rte = read("with_routes").rte;
    assert_eq!((file.rte.len(), file.trk.len()), (2, 2));
    let mut fx = Fixture::default();
    let id = file.id;
    fx.files.insert(id, Rc::new(file));
    fx.order.0.push(id);
    (fx, id)
}

fn file(fx: &Fixture, id: FileId) -> &File {
    &fx.files[&id]
}

fn routes(fx: &Fixture, id: FileId, indices: &[usize]) -> Selection {
    Selection::Route {
        file_id: id,
        rte_ids: indices.iter().map(|i| file(fx, id).rte[*i].id).collect(),
    }
}

fn whole(id: FileId) -> Selection {
    Selection::File {
        file_ids: [id].into(),
    }
}

fn lengths(file: &File) -> Vec<usize> {
    file.segments().map(|segment| segment.len()).collect()
}

#[test]
fn test_the_segments_of_a_file_are_the_ones_of_its_routes_then_its_tracks() {
    let (fx, id) = fixture();
    let file = file(&fx, id);
    let locations = whole(id).segment_locations(&fx.files, &fx.order.0);
    let indices: Vec<SegmentIndex> = locations.iter().map(|l| l.index).collect();
    assert_eq!(
        indices,
        [
            SegmentIndex::Route(0),
            SegmentIndex::Route(1),
            SegmentIndex::Track { trk: 0, seg: 0 },
            SegmentIndex::Track { trk: 0, seg: 1 },
            SegmentIndex::Track { trk: 1, seg: 0 },
            SegmentIndex::Track { trk: 1, seg: 1 },
        ]
    );
    // a selection of routes covers their segments only
    let selected = routes(&fx, id, &[1]).segment_locations(&fx.files, &fx.order.0);
    assert_eq!(selected.len(), 1);
    assert_eq!(selected[0].segment(&fx.files).id, file.rte[1].seg.id);
}

#[test]
fn test_routes_are_selected_like_tracks() {
    let (fx, id) = fixture();
    let ids: Vec<RouteId> = file(&fx, id).rte.iter().map(|r| r.id).collect();

    let mut selection = routes(&fx, id, &[0]);
    selection.extend(routes(&fx, id, &[1]));
    assert_eq!(selection, routes(&fx, id, &[0, 1]));
    selection.toggle(routes(&fx, id, &[0]));
    assert_eq!(selection, routes(&fx, id, &[1]));
    // routes and tracks are not selected together
    let track = Selection::Track {
        file_id: id,
        trk_ids: [file(&fx, id).trk[0].id].into(),
    };
    selection.extend(track.clone());
    assert_eq!(selection, track);

    assert_eq!(
        routes(&fx, id, &[0]).all_at_level(&fx.files, &fx.order.0),
        Some(routes(&fx, id, &[0, 1]))
    );
    assert_eq!(
        routes(&fx, id, &[0]).neighbour(&fx.files, &fx.order.0, true),
        Some(routes(&fx, id, &[1]))
    );
    assert_eq!(
        routes(&fx, id, &[1]).neighbour(&fx.files, &fx.order.0, true),
        None
    );
    assert_eq!(routes(&fx, id, &[1]).to_files(), whole(id));

    let mut gone = Selection::Route {
        file_id: id,
        rte_ids: [ids[0], RouteId::default()].into(),
    };
    gone.retain_existing(&fx.files);
    assert_eq!(gone, routes(&fx, id, &[0]));
}

#[test]
fn test_delete_and_duplicate_routes() {
    let (mut fx, id) = fixture();
    let kept = file(&fx, id).rte[1].id;
    fx.selection = routes(&fx, id, &[0]);
    Delete { whole_files: false }
        .apply(&mut fx.state())
        .unwrap();
    assert_eq!(file(&fx, id).rte.len(), 1);
    assert_eq!(file(&fx, id).rte[0].id, kept);
    assert_eq!(file(&fx, id).trk.len(), 2);
    assert_eq!(fx.selection, whole(id));

    fx.selection = routes(&fx, id, &[0]);
    Duplicate.apply(&mut fx.state()).unwrap();
    let file = file(&fx, id);
    assert_eq!(file.rte.len(), 2);
    assert_ne!(file.rte[1].id, kept);
    assert_ne!(file.rte[1].seg.id, file.rte[0].seg.id);
    assert_eq!(file.rte[1].info, file.rte[0].info);
    assert_eq!(
        fx.selection,
        Selection::Route {
            file_id: id,
            rte_ids: [file.rte[1].id].into()
        }
    );
}

#[test]
fn test_metadata_and_style_of_routes() {
    let (mut fx, id) = fixture();
    fx.selection = routes(&fx, id, &[1]);
    Metadata {
        name: "renamed",
        desc: "about",
    }
    .apply(&mut fx.state())
    .unwrap();
    Style {
        color: Some("00ff00"),
        opacity: None,
        width: Some(3.0),
    }
    .apply(&mut fx.state())
    .unwrap();
    let file = file(&fx, id);
    let info = &file.rte[1].info;
    assert_eq!(info.name.as_deref(), Some("renamed"));
    assert_eq!(info.desc.as_deref(), Some("about"));
    assert_eq!(info.color.as_deref(), Some("00ff00"));
    assert_eq!(info.width, Some(3.0));
    assert_ne!(file.rte[0].info.name.as_deref(), Some("renamed"));

    // the style of a file is the one of its routes and tracks
    fx.selection = whole(id);
    Style {
        color: Some("ff0000"),
        opacity: None,
        width: None,
    }
    .apply(&mut fx.state())
    .unwrap();
    let file = &fx.files[&id];
    assert!(
        file.rte
            .iter()
            .map(|r| &r.info)
            .chain(file.trk.iter().map(|t| &t.info))
            .all(|info| info.color.as_deref() == Some("ff0000"))
    );
}

#[test]
fn test_copy_and_paste_routes() {
    let (mut fx, id) = fixture();
    let copied = file(&fx, id).rte[0].clone();
    fx.clipboard = Clipboard::new(&routes(&fx, id, &[0]), &fx.files, &fx.order.0, false);
    assert!(matches!(
        fx.clipboard.as_ref().unwrap().content,
        ClipboardContent::Routes(_)
    ));

    // after the selected route
    fx.selection = routes(&fx, id, &[1]);
    Paste.apply(&mut fx.state()).unwrap();
    let file = file(&fx, id);
    assert_eq!(file.rte.len(), 3);
    assert_ne!(file.rte[2].id, copied.id);
    assert_eq!(file.rte[2].seg.len(), copied.seg.len());
    assert!(
        matches!(&fx.selection, Selection::Route { rte_ids, .. } if rte_ids.contains(&file.rte[2].id))
    );

    // nothing selected: a new file, named like the route
    fx.selection = Selection::Empty;
    Paste.apply(&mut fx.state()).unwrap();
    assert_eq!(fx.order.0.len(), 2);
    let new = &fx.files[&fx.order.0[1]];
    assert_eq!(new.rte.len(), 1);
    assert!(new.trk.is_empty());
    assert_eq!(Some(&new.info.name), copied.info.name.as_ref());

    // a track selected: among the routes of its file
    fx.selection = Selection::Track {
        file_id: id,
        trk_ids: [fx.files[&id].trk[0].id].into(),
    };
    Paste.apply(&mut fx.state()).unwrap();
    assert_eq!(fx.files[&id].rte.len(), 4);

    // segments do not go in a route, but become routes next to it
    let file = &fx.files[&id];
    let track = &file.trk[0];
    fx.clipboard = Clipboard::new(
        &Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: [track.trkseg[1].id].into(),
        },
        &fx.files,
        &fx.order.0,
        false,
    );
    fx.selection = routes(&fx, id, &[0]);
    Paste.apply(&mut fx.state()).unwrap();
    let file = &fx.files[&id];
    assert_eq!(file.rte.len(), 5);
    assert_eq!(file.rte[1].seg.len(), file.trk[0].trkseg[1].len());
}

#[test]
fn test_cut_tracks_pasted_on_a_route_go_first_among_the_tracks() {
    let (mut fx, id) = fixture();
    let moved = file(&fx, id).trk[1].id;
    fx.clipboard = Clipboard::new(
        &Selection::Track {
            file_id: id,
            trk_ids: [moved].into(),
        },
        &fx.files,
        &fx.order.0,
        true,
    );
    fx.selection = routes(&fx, id, &[0]);
    Paste.apply(&mut fx.state()).unwrap();
    let file = file(&fx, id);
    assert_eq!(file.trk.len(), 2);
    assert_eq!(file.trk[0].id, moved);
    assert_eq!(file.rte.len(), 2);
}

#[test]
fn test_move_routes() {
    let (mut fx, id) = fixture();
    let ids: Vec<RouteId> = file(&fx, id).rte.iter().map(|r| r.id).collect();
    Move {
        what: routes(&fx, id, &[1]),
        to: MoveTarget::Routes {
            file_id: id,
            index: 0,
        },
    }
    .apply(&mut fx.state())
    .unwrap();
    let order: Vec<RouteId> = file(&fx, id).rte.iter().map(|r| r.id).collect();
    assert_eq!(order, [ids[1], ids[0]]);

    // to the files: a file of its own
    Move {
        what: routes(&fx, id, &[0]),
        to: MoveTarget::Files { index: 1 },
    }
    .apply(&mut fx.state())
    .unwrap();
    assert_eq!(file(&fx, id).rte.len(), 1);
    let new = &fx.files[&fx.order.0[1]];
    assert_eq!(new.rte[0].id, ids[1]);

    // a segment moved among the routes becomes one
    let track = &file(&fx, id).trk[0];
    let segment = track.trkseg[0].id;
    Move {
        what: Selection::TrackSegment {
            file_id: id,
            trk_id: track.id,
            trkseg_ids: [segment].into(),
        },
        to: MoveTarget::Routes {
            file_id: id,
            index: 1,
        },
    }
    .apply(&mut fx.state())
    .unwrap();
    let file = file(&fx, id);
    assert_eq!(file.rte[1].seg.id, segment);
    assert_eq!(file.trk[0].trkseg.len(), 1);
}

#[test]
fn test_routes_and_tracks_moved_among_each_other_keep_their_kind() {
    let (mut fx, id) = fixture();
    let route = file(&fx, id).rte[0].id;
    let track = file(&fx, id).trk[1].id;

    // a route among the tracks: after the other routes, which come first
    Move {
        what: routes(&fx, id, &[0]),
        to: MoveTarget::Tracks {
            file_id: id,
            index: 1,
        },
    }
    .apply(&mut fx.state())
    .unwrap();
    let moved = file(&fx, id);
    assert_eq!((moved.rte.len(), moved.trk.len()), (2, 2));
    assert_eq!(moved.rte[1].id, route);
    assert_eq!(
        fx.selection,
        Selection::Route {
            file_id: id,
            rte_ids: [route].into()
        }
    );

    // a track among the routes: before the other tracks, which come after the routes
    Move {
        what: Selection::Track {
            file_id: id,
            trk_ids: [track].into(),
        },
        to: MoveTarget::Routes {
            file_id: id,
            index: 0,
        },
    }
    .apply(&mut fx.state())
    .unwrap();
    let moved = file(&fx, id);
    assert_eq!((moved.rte.len(), moved.trk.len()), (2, 2));
    assert_eq!(moved.trk[0].id, track);

    // and copied routes pasted on a track stay routes
    fx.clipboard = Clipboard::new(&routes(&fx, id, &[0]), &fx.files, &fx.order.0, false);
    fx.selection = Selection::Track {
        file_id: id,
        trk_ids: [track].into(),
    };
    Paste.apply(&mut fx.state()).unwrap();
    let pasted = file(&fx, id);
    assert_eq!((pasted.rte.len(), pasted.trk.len()), (3, 2));
}

#[test]
fn test_merge_routes() {
    let (mut fx, id) = fixture();
    let before = lengths(file(&fx, id));
    let first = file(&fx, id).rte[0].id;
    fx.selection = routes(&fx, id, &[0, 1]);
    let merge = |type_| Merge {
        type_,
        remove_gaps: false,
        keep_originals: false,
    };
    assert_eq!(
        merge(MergeType::Group).apply(&mut fx.state()),
        Err(CommandError::NothingToDo)
    );
    merge(MergeType::Connect).apply(&mut fx.state()).unwrap();
    let file = file(&fx, id);
    assert_eq!(file.rte.len(), 1);
    assert_eq!(file.rte[0].id, first);
    assert_eq!(file.rte[0].seg.len(), before[0] + before[1]);
    assert_eq!(file.trk.len(), 2);
}

#[test]
fn test_merge_files_with_routes() {
    let (mut fx, id) = fixture();
    let other = File {
        rte: file(&fx, id).rte.iter().map(crate::copy_route).collect(),
        ..File::default()
    };
    let other_id = other.id;
    fx.files.insert(other_id, Rc::new(other));
    fx.order.0.push(other_id);
    let total: usize = lengths(file(&fx, id)).iter().sum::<usize>()
        + lengths(&fx.files[&other_id]).iter().sum::<usize>();

    let mut grouped = Fixture {
        files: fx.files.clone(),
        order: fx.order.clone(),
        selection: Selection::File {
            file_ids: [id, other_id].into(),
        },
        ..Default::default()
    };
    Merge {
        type_: MergeType::Group,
        remove_gaps: false,
        keep_originals: false,
    }
    .apply(&mut grouped.state())
    .unwrap();
    let merged = &grouped.files[&id];
    assert_eq!((merged.rte.len(), merged.trk.len()), (4, 2));
    assert!(!grouped.files.contains_key(&other_id));

    // connected in the first route, which comes first
    fx.selection = Selection::File {
        file_ids: [id, other_id].into(),
    };
    Merge {
        type_: MergeType::Connect,
        remove_gaps: false,
        keep_originals: false,
    }
    .apply(&mut fx.state())
    .unwrap();
    let merged = &fx.files[&id];
    assert_eq!((merged.rte.len(), merged.trk.len()), (1, 0));
    assert_eq!(merged.rte[0].seg.len(), total);
}

#[test]
fn test_extract_a_file_with_routes() {
    let (mut fx, id) = fixture();
    let names: Vec<_> = file(&fx, id)
        .rte
        .iter()
        .map(|r| r.info.name.clone().unwrap())
        .collect();
    fx.selection = whole(id);
    Extract {
        keep_originals: false,
    }
    .apply(&mut fx.state())
    .unwrap();
    // one file per route and one per track
    assert_eq!(fx.order.0.len(), 4);
    let files: Vec<&File> = fx.order.0.iter().map(|id| &*fx.files[id]).collect();
    for (file, name) in files.iter().zip(&names) {
        assert_eq!((file.rte.len(), file.trk.len()), (1, 0));
        assert_eq!(&file.info.name, name);
    }
    for file in &files[2..] {
        assert_eq!((file.rte.len(), file.trk.len()), (0, 2));
    }

    // a route has nothing to extract
    let (mut fx, id) = fixture();
    fx.selection = routes(&fx, id, &[0]);
    assert_eq!(
        Extract {
            keep_originals: false
        }
        .apply(&mut fx.state()),
        Err(CommandError::NothingToDo)
    );
}

#[test]
fn test_split_a_route() {
    let (mut fx, id) = fixture();
    let before = file(&fx, id).rte[1].clone();
    fx.selection = routes(&fx, id, &[1]);
    Split {
        at: 10,
        split_type: SplitType::Routes,
        keep_originals: false,
    }
    .apply(&mut fx.state())
    .unwrap();
    // two routes, which share the trackpoint
    let split = file(&fx, id);
    assert_eq!(split.rte.len(), 3);
    assert_eq!(split.rte[1].id, before.id);
    assert_ne!(split.rte[2].id, before.id);
    assert_eq!(split.rte[1].seg.len(), 11);
    assert_eq!(split.rte[2].seg.len(), before.seg.len() - 10);
    assert_eq!(split.rte[2].info, before.info);

    // a route is not a track nor a segment, and the other way around
    let (mut fx, id) = fixture();
    fx.selection = whole(id);
    let segment_start = lengths(file(&fx, id))[..2].iter().sum::<usize>() as u32;
    for (at, split_type) in [
        (10, SplitType::Tracks),
        (10, SplitType::Segments),
        (segment_start + 10, SplitType::Routes),
    ] {
        assert_eq!(
            Split {
                at,
                split_type,
                keep_originals: false,
            }
            .apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
    assert_eq!(file(&fx, id).rte.len(), 2);

    // into two files: the following routes and the tracks go to the second one
    let (mut fx, id) = fixture();
    let first_len = file(&fx, id).rte[0].seg.len();
    fx.selection = whole(id);
    Split {
        at: 5,
        split_type: SplitType::Files,
        keep_originals: false,
    }
    .apply(&mut fx.state())
    .unwrap();
    assert_eq!(fx.order.0.len(), 2);
    let (a, b) = (&fx.files[&fx.order.0[0]], &fx.files[&fx.order.0[1]]);
    assert_eq!(a.id, id);
    assert_eq!((a.rte.len(), a.trk.len()), (1, 0));
    assert_eq!(a.rte[0].seg.len(), 6);
    assert_eq!((b.rte.len(), b.trk.len()), (2, 2));
    assert_eq!(b.rte[0].seg.len(), first_len - 5);
}

#[test]
fn test_crop_removes_the_routes_left_without_trackpoints() {
    let (mut fx, id) = fixture();
    let len = lengths(file(&fx, id));
    fx.selection = whole(id);
    // the second route only
    let start = len[0] as u32;
    Crop {
        start,
        end: start + len[1] as u32 - 1,
    }
    .apply(&mut fx.state())
    .unwrap();
    let file = file(&fx, id);
    assert_eq!((file.rte.len(), file.trk.len()), (1, 0));
    assert_eq!(file.rte[0].seg.len(), len[1]);
}

#[test]
fn test_clean_removes_the_routes_left_without_trackpoints() {
    let (mut fx, id) = fixture();
    fx.selection = routes(&fx, id, &[0]);
    let everywhere = LngLatBounds {
        sw: LngLat {
            lng: -180.0,
            lat: -90.0,
        },
        ne: LngLat {
            lng: 180.0,
            lat: 90.0,
        },
    };
    Clean {
        bounds: everywhere,
        type_: CleanType::Inside,
        trkpt: true,
        wpt: false,
    }
    .apply(&mut fx.state())
    .unwrap();
    assert_eq!(file(&fx, id).rte.len(), 1);
    assert_eq!(fx.selection, whole(id));
}

#[test]
fn test_reverse_a_route_and_the_routes_of_a_file() {
    let (mut fx, id) = fixture();
    let before = file(&fx, id).clone();
    fx.selection = routes(&fx, id, &[0]);
    Reverse.apply(&mut fx.state()).unwrap();
    let route = &file(&fx, id).rte[0].seg;
    let original = &before.rte[0].seg;
    assert_eq!(
        route[0].coordinates.lat,
        original[original.len() - 1].coordinates.lat
    );
    assert_eq!(file(&fx, id).rte[1].seg.rev_id, before.rte[1].seg.rev_id);

    let (mut fx, id) = fixture();
    let before = file(&fx, id).clone();
    fx.selection = whole(id);
    Reverse.apply(&mut fx.state()).unwrap();
    let file = file(&fx, id);
    // the routes are in the opposite order, and still before the tracks
    assert_eq!(file.rte[0].id, before.rte[1].id);
    assert_eq!(file.trk[0].id, before.trk[1].id);
}

#[test]
fn test_convert_routes_to_tracks_and_back() {
    let (mut fx, id) = fixture();
    let before = file(&fx, id).clone();

    // a route becomes a track, first among the tracks, with its segment and its information
    fx.selection = routes(&fx, id, &[1]);
    Convert.apply(&mut fx.state()).unwrap();
    let converted = file(&fx, id);
    assert_eq!((converted.rte.len(), converted.trk.len()), (1, 3));
    assert_eq!(converted.trk[0].info, before.rte[1].info);
    assert_eq!(converted.trk[0].trkseg.len(), 1);
    assert_eq!(converted.trk[0].trkseg[0].id, before.rte[1].seg.id);
    assert_eq!(
        fx.selection,
        Selection::Track {
            file_id: id,
            trk_ids: [converted.trk[0].id].into()
        }
    );

    // and back: a route again, after the other routes
    Convert.apply(&mut fx.state()).unwrap();
    let back = file(&fx, id);
    assert_eq!((back.rte.len(), back.trk.len()), (2, 2));
    assert_eq!(back.rte[1].seg.id, before.rte[1].seg.id);
    assert_eq!(back.rte[1].info, before.rte[1].info);
    assert!(
        matches!(&fx.selection, Selection::Route { rte_ids, .. } if rte_ids.contains(&back.rte[1].id))
    );
}

#[test]
fn test_convert_a_track_to_one_route_per_segment() {
    let (mut fx, id) = fixture();
    let track = file(&fx, id).trk[0].clone();
    assert_eq!(track.trkseg.len(), 2);
    fx.selection = Selection::Track {
        file_id: id,
        trk_ids: [track.id].into(),
    };
    Convert.apply(&mut fx.state()).unwrap();
    let converted = file(&fx, id);
    assert_eq!((converted.rte.len(), converted.trk.len()), (4, 1));
    for (route, segment) in converted.rte[2..].iter().zip(&track.trkseg) {
        assert_eq!(route.seg.id, segment.id);
        assert_eq!(route.info, track.info);
    }
    assert!(matches!(&fx.selection, Selection::Route { rte_ids, .. } if rte_ids.len() == 2));
}

#[test]
fn test_convert_segments_to_routes_keeps_their_track() {
    let (mut fx, id) = fixture();
    let track = file(&fx, id).trk[1].clone();
    fx.selection = Selection::TrackSegment {
        file_id: id,
        trk_id: track.id,
        trkseg_ids: [track.trkseg[0].id, track.trkseg[1].id].into(),
    };
    Convert.apply(&mut fx.state()).unwrap();
    let converted = file(&fx, id);
    assert_eq!((converted.rte.len(), converted.trk.len()), (4, 2));
    assert!(converted.trk[1].trkseg.is_empty());
    assert_eq!(converted.rte[2].seg.id, track.trkseg[0].id);

    // nothing to convert otherwise
    for selection in [
        whole(id),
        Selection::Empty,
        Selection::Waypoints { file_id: id },
    ] {
        fx.selection = selection;
        assert_eq!(
            Convert.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }
}
