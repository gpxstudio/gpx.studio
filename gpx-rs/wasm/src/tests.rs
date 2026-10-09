//! Tests of the JS interface, run with `wasm-pack test --node wasm` (they need a JS environment).
//!
//! Every test starts a new engine, which is what the page does once.

#![allow(clippy::needless_borrows_for_generic_args)]

use js_sys::{Array, BigInt64Array, Float64Array, Object, Reflect};
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

use crate::command::history::*;
use crate::session::*;
use crate::ts::Outcome;
use crate::types::*;

const SIMPLE: &[u8] = include_bytes!("../../engine/data/simple.gpx");
const WITH_TIME: &[u8] = include_bytes!("../../engine/data/with_time.gpx");
const WITH_SURFACE: &[u8] = include_bytes!("../../engine/data/with_surface.gpx");

thread_local! {
    static LAST: std::cell::RefCell<JsValue> = const { std::cell::RefCell::new(JsValue::UNDEFINED) };
}

/// Keeps the outcome of a call for the checks that follow it, and tells whether it changed anything.
fn run(outcome: Outcome) -> bool {
    let outcome = JsValue::from(outcome);
    let changed = get(&outcome, "changed").as_bool().unwrap();
    LAST.with(|last| *last.borrow_mut() = outcome);
    changed
}

fn last_outcome() -> JsValue {
    LAST.with(|last| last.borrow().clone())
}

fn last_error() -> Option<String> {
    get(&last_outcome(), "error").as_string()
}

fn get(object: impl AsRef<JsValue>, key: &str) -> JsValue {
    Reflect::get(object.as_ref(), &key.into()).unwrap()
}

fn array(value: impl Into<JsValue>) -> Array {
    Array::from(&value.into())
}

fn strings(value: impl Into<JsValue>) -> Vec<String> {
    array(value)
        .iter()
        .map(|v| v.as_string().unwrap())
        .collect()
}

/// Starts a new engine and loads the given files (one command).
fn started_with(files: &[(&[u8], &str)]) {
    start();
    if files.is_empty() {
        return;
    }
    let data: Vec<u8> = files
        .iter()
        .flat_map(|(data, _)| data.iter().copied())
        .collect();
    let lengths: Vec<u32> = files.iter().map(|(data, _)| data.len() as u32).collect();
    let names = files.iter().map(|(_, name)| name.to_string()).collect();
    assert!(run(crate::command::files::load_files(
        &data, &lengths, names
    )));
}

fn order() -> Vec<String> {
    strings(crate::queries::files::file_order())
}

fn uuid_bytes(ids: &[String]) -> Vec<u8> {
    ids.iter()
        .flat_map(|id| *uuid::Uuid::parse_str(id).unwrap().as_bytes())
        .collect()
}

#[wasm_bindgen_test]
fn test_new_file_is_listed_and_selected() {
    start();
    assert!(run(crate::command::files::new_file(
        "route", None, None, None
    )));
    assert_eq!(last_error(), None);

    let ids = order();
    assert_eq!(ids.len(), 1);
    let structure = crate::queries::files::file_structure(&ids[0]);
    assert_eq!(
        get(&structure, "name").as_string().as_deref(),
        Some("route")
    );
    assert_eq!(array(get(&structure, "tracks")).length(), 0);

    let selection = crate::queries::files::selection();
    assert_eq!(get(&selection, "type").as_string().as_deref(), Some("file"));
    assert_eq!(strings(get(&selection, "fileIds")), ids);

    let update = last_outcome();
    assert_eq!(strings(get(&update, "added")), ids);
    assert_eq!(get(&update, "orderChanged").as_bool(), Some(true));
}

#[wasm_bindgen_test]
fn test_unknown_file_has_no_structure() {
    started_with(&[]);
    let id = uuid::Uuid::new_v4().to_string();
    assert!(crate::queries::files::file_structure(&id).is_undefined());
    assert!(crate::queries::files::file_structure("not an id").is_undefined());
    assert!(crate::queries::files::file_statistics(&id).is_undefined());
    assert!(
        crate::queries::files::export_file(&id, true, true, true, true, true, true, false)
            .is_none()
    );
    assert_eq!(
        crate::queries::coordinates::segment_coordinates(&id).length(),
        0
    );
    assert_eq!(
        crate::queries::coordinates::waypoint_coordinates("nope").length(),
        0
    );
}

#[wasm_bindgen_test]
fn test_loaded_file_has_statistics_and_coordinates() {
    started_with(&[(SIMPLE, "simple")]);
    let id = order().remove(0);

    let stats = crate::queries::files::file_statistics(&id);
    assert!(get(&stats, "totalDistance").as_f64().unwrap() > 0.0);
    // the file is selected: the buffers describe it
    let selection_stats = crate::queries::files::selection_statistics();
    assert_eq!(
        get(&selection_stats, "totalDistance").as_f64(),
        get(&stats, "totalDistance").as_f64()
    );
    let n = crate::queries::statistics::total_distance().length();
    assert!(n > 0);
    assert_eq!(crate::queries::statistics::lng().length(), n);
    assert_eq!(crate::queries::statistics::ele().length(), n);
    // no timestamps in this file
    assert!(crate::queries::statistics::timestamps().is_none());

    let structure = crate::queries::files::file_structure(&id);
    let segment = get(
        &array(get(&array(get(&structure, "tracks")).get(0), "segments")).get(0),
        "id",
    );
    let coordinates =
        crate::queries::coordinates::segment_coordinates(&segment.as_string().unwrap());
    assert_eq!(coordinates.length(), 2 * n);

    // the routing buffers: one segment, anchored at both ends
    assert_eq!(crate::queries::routing::segment_starts().to_vec(), vec![0]);
    let anchors = crate::queries::routing::anchor_indices().to_vec();
    assert_eq!(anchors.first(), Some(&0));
    assert_eq!(anchors.last(), Some(&(n - 1)));
}

#[wasm_bindgen_test]
fn test_timestamps_and_categories() {
    started_with(&[(WITH_TIME, "time")]);
    let times: BigInt64Array = crate::queries::statistics::timestamps().unwrap();
    assert!(times.length() > 0);
    assert!(crate::queries::statistics::total_time().is_some());

    started_with(&[(WITH_SURFACE, "surface")]);
    let surfaces = strings(crate::queries::statistics::surfaces());
    assert!(!surfaces.is_empty());
    let values = crate::queries::statistics::surface_values().to_vec();
    assert!(values.iter().any(|v| *v > 0));
    assert!(values.iter().all(|v| (*v as usize) <= surfaces.len()));
    assert_eq!(
        crate::queries::statistics::surface_starts().length(),
        values.len() as u32
    );
}

#[wasm_bindgen_test]
fn test_the_reason_of_a_failure_can_be_read() {
    started_with(&[]);

    // nothing to do
    assert!(!run(crate::command::tools::reverse()));
    assert_eq!(last_error().as_deref(), Some("nothing to do"));
    // the next call starts afresh
    assert!(run(crate::command::files::new_file("a", None, None, None)));
    assert_eq!(last_error(), None);

    // invalid data
    assert!(!run(crate::command::files::load_files(
        b"<gpx><trk></gpx>",
        &[16],
        vec!["bad".into()]
    )));
    assert!(last_error().unwrap().starts_with("invalid data"));
    assert_eq!(order().len(), 1);

    // arguments that do not make sense
    assert!(!run(crate::command::files::load_files(
        b"",
        &[1, 2],
        vec!["a".into()]
    )));
    assert!(last_error().unwrap().contains("lengths"));
    assert!(!run(crate::command::files::load_files(
        b"abc",
        &[10],
        vec!["a".into()]
    )));
    assert!(last_error().unwrap().contains("shorter"));
    assert!(!run(crate::command::files::reorder(&[1, 2, 3], 0)));
    assert!(last_error().unwrap().contains("UUIDs"));
    assert!(!run(crate::command::tools::crop(5, 1)));
    assert!(last_error().unwrap().contains("reversed"));
    assert!(!run(crate::command::waypoints::delete_waypoint("x", "y")));
    assert!(last_error().unwrap().contains("UUID"));
    assert!(!run(crate::selection::select_tracks(
        "x",
        &[],
        SelectMode::Replace
    )));
    assert!(last_error().unwrap().contains("UUIDs"));

    // a stale revision
    let stale = crate::queries::routing::routing_revision().wrapping_add(1);
    assert!(!run(crate::command::routing::insert_anchor(
        stale, 0.0, 0.0
    )));
    assert!(last_error().unwrap().contains("routing buffers"));
    assert!(!run(crate::command::routing::change_loop_start(stale, 0)));
    assert!(!run(crate::command::routing::split(
        stale,
        0,
        SplitType::Files
    )));
    assert!(last_error().is_some());

    // answers are not failures
    assert!(run(crate::command::files::new_file("b", None, None, None)));
    assert!(!crate::command::files::can_paste());
    assert_eq!(last_error(), None);
}

#[wasm_bindgen_test]
fn test_undo_and_redo() {
    started_with(&[]);
    assert!(!can_undo() && !can_redo());
    assert!(run(crate::command::files::new_file("a", None, None, None)));
    assert!(can_undo() && !can_redo());
    assert!(run(undo()));
    assert!(order().is_empty());
    assert!(can_redo());
    assert!(run(redo()));
    assert_eq!(order().len(), 1);
    // nothing to redo is not an error of the engine
    assert!(!run(redo()));
}

#[wasm_bindgen_test]
fn test_export_and_exportable_data() {
    started_with(&[(SIMPLE, "plain"), (WITH_TIME, "timed")]);
    let ids = order();

    let bytes =
        crate::queries::files::export_file(&ids[0], true, true, true, true, true, true, false)
            .unwrap();
    assert!(String::from_utf8(bytes).unwrap().contains("<gpx"));

    // the time is the first bit
    assert_eq!(
        crate::queries::files::exportable_data(&uuid_bytes(&ids[..1])) & 1,
        0
    );
    assert_eq!(
        crate::queries::files::exportable_data(&uuid_bytes(&ids[1..])) & 1,
        1
    );
    assert_eq!(
        crate::queries::files::exportable_data(&uuid_bytes(&ids)) & 1,
        1
    );
    assert_eq!(crate::queries::files::exportable_data(&[1, 2, 3]), 0);
}

#[wasm_bindgen_test]
fn test_export_as_route() {
    started_with(&[(SIMPLE, "plain")]);
    let id = order().remove(0);
    let text = |as_route| {
        let bytes =
            crate::queries::files::export_file(&id, true, true, true, true, true, true, as_route)
                .unwrap();
        String::from_utf8(bytes).unwrap()
    };
    let tracks = text(false);
    assert!(tracks.contains("<trk>") && !tracks.contains("<rte>"));
    let routes = text(true);
    assert!(routes.contains("<rte>") && !routes.contains("<trk>"));
    assert!(routes.contains("<rtept"));
}

#[wasm_bindgen_test]
fn test_select_and_reorder_files() {
    started_with(&[(SIMPLE, "a"), (WITH_TIME, "b")]);
    let ids = order();

    assert!(run(crate::selection::select(
        &uuid_bytes(&ids[1..]),
        SelectMode::Replace
    )));
    assert_eq!(
        strings(get(&crate::queries::files::selection(), "fileIds")),
        ids[1..]
    );
    assert!(run(crate::selection::select(
        &uuid_bytes(&ids[..1]),
        SelectMode::Add
    )));
    assert_eq!(
        array(get(&crate::queries::files::selection(), "fileIds")).length(),
        2
    );
    assert!(run(crate::selection::select(
        &uuid_bytes(&ids[..1]),
        SelectMode::Toggle
    )));
    assert_eq!(
        strings(get(&crate::queries::files::selection(), "fileIds")),
        ids[1..]
    );

    // reordering is a change of the order, nothing else
    let reversed: Vec<String> = ids.iter().rev().cloned().collect();
    assert!(run(crate::command::files::reorder(
        &uuid_bytes(&reversed[..1]),
        0
    )));
    assert_eq!(order(), reversed);
    assert_eq!(get(&last_outcome(), "orderChanged").as_bool(), Some(true));
}

#[wasm_bindgen_test]
fn test_move_elements_takes_js_objects() {
    started_with(&[(SIMPLE, "a"), (WITH_TIME, "b")]);
    let ids = order();
    assert!(run(crate::selection::select(
        &uuid_bytes(&ids[1..]),
        SelectMode::Replace
    )));

    let target = Object::new();
    Reflect::set(&target, &"type".into(), &"files".into()).unwrap();
    Reflect::set(&target, &"index".into(), &0.into()).unwrap();
    let what = JsValue::from(crate::queries::files::selection());
    assert!(run(crate::command::files::move_elements(
        what.clone().unchecked_into(),
        JsValue::from(target).unchecked_into()
    )));
    assert_eq!(order(), vec![ids[1].clone(), ids[0].clone()]);

    // an unknown target
    let bad = Object::new();
    Reflect::set(&bad, &"type".into(), &"nowhere".into()).unwrap();
    Reflect::set(&bad, &"index".into(), &0.into()).unwrap();
    assert!(!run(crate::command::files::move_elements(
        what.unchecked_into(),
        JsValue::from(bad).unchecked_into()
    )));
    assert!(last_error().unwrap().contains("not valid"));
}

#[wasm_bindgen_test]
fn test_waypoints() {
    started_with(&[]);
    assert!(run(crate::command::files::new_file(
        "file", None, None, None
    )));
    let file = order().remove(0);
    assert!(run(crate::command::waypoints::new_waypoint(
        4.0, 50.0, 100.0, "summit", "", "", ""
    )));

    let structure = crate::queries::files::file_structure(&file);
    let waypoints = array(get(&structure, "waypoints"));
    assert_eq!(waypoints.length(), 1);
    let id = get(&waypoints.get(0), "id").as_string().unwrap();
    let details = crate::queries::files::waypoint(&file, &id);
    assert_eq!(get(&details, "name").as_string().as_deref(), Some("summit"));
    assert_eq!(get(&details, "ele").as_f64(), Some(100.0));
    assert_eq!(
        crate::queries::coordinates::waypoint_coordinates(&file).to_vec(),
        vec![4.0, 50.0]
    );

    assert!(run(crate::command::waypoints::update_waypoint(
        &file, &id, 5.0, 51.0, 120.0, "peak", "", "", ""
    )));
    let details = crate::queries::files::waypoint(&file, &id);
    assert_eq!(get(&details, "name").as_string().as_deref(), Some("peak"));
    assert!(run(crate::command::waypoints::move_waypoint(
        &file, &id, 6.0, 52.0, 130.0
    )));
    assert_eq!(
        crate::queries::coordinates::waypoint_coordinates(&file).to_vec(),
        vec![6.0, 52.0]
    );

    // the structure tells the coordinates changed
    let rev = get(
        &crate::queries::files::file_structure(&file),
        "waypointsRev",
    );
    assert!(run(crate::command::waypoints::move_waypoint(
        &file, &id, 7.0, 52.0, 130.0
    )));
    assert_ne!(
        get(
            &crate::queries::files::file_structure(&file),
            "waypointsRev"
        ),
        rev
    );

    assert!(run(crate::command::waypoints::delete_waypoint(&file, &id)));
    assert!(crate::queries::files::waypoint(&file, &id).is_undefined());
    // already gone
    assert!(!run(crate::command::waypoints::delete_waypoint(&file, &id)));
    assert!(last_error().is_some());
}

#[wasm_bindgen_test]
fn test_clipboard() {
    started_with(&[(SIMPLE, "a")]);
    assert!(crate::queries::files::clipboard().is_undefined());
    assert!(run(crate::command::files::copy()));
    let clipboard = crate::queries::files::clipboard();
    assert_eq!(
        get(&clipboard, "type").as_string().as_deref(),
        Some("files")
    );
    assert_eq!(get(&clipboard, "cut").as_bool(), Some(false));
    assert!(crate::command::files::can_paste());
    assert!(run(crate::command::files::paste()));
    assert_eq!(order().len(), 2);
}

#[wasm_bindgen_test]
fn test_editing_tools_change_the_statistics() {
    started_with(&[(SIMPLE, "a")]);
    let before = crate::queries::statistics::total_distance().length();
    assert!(run(crate::command::tools::crop(0, 9)));
    assert_eq!(crate::queries::statistics::total_distance().length(), 10);
    assert!(run(undo()));
    assert_eq!(
        crate::queries::statistics::total_distance().length(),
        before
    );

    // one elevation per trackpoint
    let ele = Float64Array::new_with_length(before);
    assert!(run(crate::command::tools::elevation(&ele.to_vec())));
    assert!(
        crate::queries::statistics::ele()
            .to_vec()
            .iter()
            .all(|e| *e == 0.0)
    );
    assert!(!run(crate::command::tools::elevation(&[1.0])));
    assert!(last_error().unwrap().contains("elevations"));

    assert!(
        run(crate::command::tools::reduce(5.0)) || last_error().as_deref() == Some("nothing to do")
    );
    assert!(crate::queries::statistics::total_distance().length() <= before);
}

#[wasm_bindgen_test]
fn test_last_update_describes_the_last_call_only() {
    started_with(&[]);
    assert!(run(crate::command::files::new_file("a", None, None, None)));
    let update = last_outcome();
    assert_eq!(array(get(&update, "added")).length(), 1);
    assert_eq!(get(&update, "orderChanged").as_bool(), Some(true));

    // a call that does nothing replaces it, whether the engine refuses or the arguments are wrong
    assert!(!run(crate::command::tools::reverse()));
    let update = last_outcome();
    assert_eq!(array(get(&update, "added")).length(), 0);
    assert_eq!(get(&update, "orderChanged").as_bool(), Some(false));
    assert_eq!(get(&update, "selectionChanged").as_bool(), Some(false));

    assert!(run(crate::command::files::new_file("b", None, None, None)));
    assert!(!run(crate::command::tools::crop(3, 1)));
    let update = last_outcome();
    assert_eq!(array(get(&update, "added")).length(), 0);
    assert_eq!(get(&update, "orderChanged").as_bool(), Some(false));
}
