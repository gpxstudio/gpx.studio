//! The commands, called the way the frontend calls them (through the IPC of Tauri), on the sample
//! files of the engine.

use serde_json::{Value, json};
use tauri::test::{INVOKE_KEY, get_ipc_response, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{WebviewWindow, ipc::CallbackFn, ipc::InvokeBody, ipc::InvokeResponseBody};

struct App(WebviewWindow<tauri::test::MockRuntime>);

impl App {
    fn new() -> Self {
        let app =
            crate::register_commands(mock_builder().manage(crate::state::AppState::temporary()))
                .build(mock_context(noop_assets()))
                .unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        // the app has to outlive its window
        std::mem::forget(app);
        Self(window)
    }

    fn request(
        &self,
        cmd: &str,
        body: InvokeBody,
        headers: tauri::http::HeaderMap,
    ) -> InvokeResponseBody {
        get_ipc_response(
            &self.0,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body,
                headers,
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .unwrap_or_else(|error| panic!("{cmd} failed: {error}"))
    }

    fn call(&self, cmd: &str, args: Value) -> Value {
        match self.request(cmd, InvokeBody::Json(args), Default::default()) {
            InvokeResponseBody::Json(json) => serde_json::from_str(&json).unwrap(),
            InvokeResponseBody::Raw(_) => panic!("{cmd} returned bytes"),
        }
    }

    fn bytes(&self, cmd: &str, args: Value) -> Vec<u8> {
        match self.request(cmd, InvokeBody::Json(args), Default::default()) {
            InvokeResponseBody::Raw(bytes) => bytes,
            InvokeResponseBody::Json(_) => panic!("{cmd} returned JSON"),
        }
    }

    fn load(&self, names: &[&str]) -> Value {
        let mut data = vec![];
        let mut lengths = vec![];
        for name in names {
            let file = std::fs::read(format!("../gpx-rs/data/{name}.gpx")).unwrap();
            lengths.push(file.len());
            data.extend(file);
        }
        let header = |value: Value| value.to_string().replace('"', "%22").parse().unwrap();
        let mut headers = tauri::http::HeaderMap::new();
        headers.insert("lengths", header(json!(lengths)));
        headers.insert("names", header(json!(names)));
        match self.request("load_files", InvokeBody::Raw(data), headers) {
            InvokeResponseBody::Json(json) => serde_json::from_str(&json).unwrap(),
            InvokeResponseBody::Raw(_) => panic!("load_files returned bytes"),
        }
    }
}

fn f64s(bytes: &[u8]) -> Vec<f64> {
    bytes
        .as_chunks::<8>()
        .0
        .iter()
        .map(|chunk| f64::from_le_bytes(*chunk))
        .collect()
}

#[test]
fn loads_files_and_describes_them() {
    let app = App::new();
    let outcome = app.load(&["simple", "with_tracks"]);
    assert_eq!(outcome["changed"], true);
    assert_eq!(outcome["added"].as_array().unwrap().len(), 2);
    assert!(outcome.get("error").is_none());

    let order = app.call("file_order", json!({}));
    let first = order[0].as_str().unwrap();
    assert_eq!(
        app.call("selection", json!({})),
        json!({ "type": "file", "fileIds": [first] })
    );

    let structure = app.call("file_structure", json!({ "fileId": first }));
    assert_eq!(structure["name"], "simple");
    let segment = &structure["tracks"][0]["segments"][0];
    let length = segment["length"].as_f64().unwrap() as usize;
    assert!(length > 0);

    // coordinates are little-endian doubles, lng and lat for each trackpoint
    let coordinates =
        f64s(&app.bytes("segment_coordinates", json!({ "segmentId": segment["id"] })));
    assert_eq!(coordinates.len(), 2 * length);

    let statistics = app.call("file_statistics", json!({ "fileId": first }));
    assert!(statistics["totalDistance"].as_f64().unwrap() > 0.0);
    assert!(
        statistics["bounds"]["west"].as_f64().unwrap()
            <= statistics["bounds"]["east"].as_f64().unwrap()
    );
    assert_eq!(
        app.call(
            "file_structure",
            json!({ "fileId": "00000000-0000-0000-0000-000000000000" })
        ),
        Value::Null
    );
}

#[test]
fn reads_the_statistics_of_the_selection() {
    let app = App::new();
    app.load(&["simple"]);
    let distance = f64s(&app.bytes("total_distance", json!({})));
    assert!(distance.len() > 1);
    assert_eq!(f64s(&app.bytes("lng", json!({}))).len(), distance.len());
    assert!(
        app.call("selection_statistics", json!({}))["totalDistance"]
            .as_f64()
            .unwrap()
            > 0.0
    );
    // optional arrays start with a byte telling whether they are there
    let hr = app.bytes("hr", json!({}));
    assert_eq!(hr[0], 0);
    // the slope segments are intervals of trackpoints
    let starts = app.bytes("slope_segment_starts", json!({}));
    let slopes = f64s(&app.bytes("slope_segment_slopes", json!({})));
    assert_eq!(starts.len() / 4, slopes.len());
    assert!(!slopes.is_empty() && slopes.len() < distance.len());
    let point = app.call("selection_point", json!({ "index": 1 }));
    assert!(point["slopeSegmentDistance"].is_number());
    assert!(point.get("time").is_none());
    assert_eq!(
        app.call("selection_point", json!({ "index": distance.len() })),
        Value::Null
    );
    assert!(
        app.call("slice_statistics", json!({ "start": 1, "end": 3 }))["totalDistance"].is_number()
    );
    assert_eq!(
        app.call("slice_statistics", json!({ "start": 0, "end": 100000 })),
        Value::Null
    );

    app.load(&["with_hr"]);
    app.call("select_all", json!({}));
    let hr = app.bytes("hr", json!({}));
    assert_eq!(hr[0], 1);
    assert_eq!((hr.len() - 1) % 8, 0);
}

#[test]
fn edits_undoes_and_selects() {
    let app = App::new();
    let outcome = app.call(
        "new_file",
        json!({ "name": "route", "lng": 4.4, "lat": 50.8 }),
    );
    assert_eq!(outcome["changed"], true);
    // each file has its own history, which starts when it appears
    assert_eq!(app.call("can_undo", json!({})), false);

    let id = app.call("file_order", json!({}))[0].clone();
    let outcome = app.call("metadata", json!({ "name": "renamed", "desc": "" }));
    assert_eq!(outcome["modified"], json!([id]));
    assert_eq!(
        app.call("file_structure", json!({ "fileId": id }))["name"],
        "renamed"
    );

    let outcome = app.call("select", json!({ "fileIds": [], "mode": "replace" }));
    assert_eq!(outcome["selectionChanged"], true);
    assert_eq!(app.call("selection", json!({})), json!({ "type": "empty" }));
    app.call("select", json!({ "fileIds": [id], "mode": "toggle" }));
    assert_eq!(app.call("can_undo", json!({})), true);

    app.call("undo", json!({}));
    assert_eq!(
        app.call("file_structure", json!({ "fileId": id }))["name"],
        "route"
    );
    assert_eq!(app.call("can_redo", json!({})), true);
    // creating the file is not something to undo
    assert_eq!(app.call("can_undo", json!({})), false);
    let outcome = app.call("undo", json!({}));
    assert_eq!(outcome["changed"], false);
    assert_eq!(app.call("file_order", json!({})), json!([id]));

    // what cannot be done says why
    let outcome = app.call("reverse", json!({}));
    assert_eq!(outcome["changed"], false);
    assert!(outcome["error"].is_string());
}

#[test]
fn moves_and_clipboard() {
    let app = App::new();
    app.load(&["simple", "with_tracks"]);
    let ids = app.call("file_order", json!({}));
    app.call("select", json!({ "fileIds": [ids[0]], "mode": "replace" }));
    app.call("copy", json!({}));
    assert_eq!(
        app.call("clipboard", json!({})),
        json!({ "type": "files", "ids": [ids[0]], "cut": false })
    );

    let outcome = app.call(
        "move_elements",
        json!({
            "what": { "type": "file", "fileIds": [ids[0]] },
            "to": { "type": "files", "index": 9007199254740991u64 },
        }),
    );
    assert_eq!(outcome["orderChanged"], true);
    assert_eq!(app.call("file_order", json!({})), json!([ids[1], ids[0]]));
}

#[test]
fn waypoints_exports_and_routing_revisions() {
    let app = App::new();
    app.call("new_file", json!({ "name": "file" }));
    let outcome = app.call(
        "new_waypoint",
        json!({ "lng": 4.4, "lat": 50.8, "ele": 100, "name": "summit", "desc": "", "icon": "Summit", "link": "https://example.com" }),
    );
    assert_eq!(outcome["changed"], true);
    let file = app.call("file_order", json!({}))[0].clone();
    let waypoint =
        app.call("file_structure", json!({ "fileId": file }))["waypoints"][0]["id"].clone();
    let details = app.call(
        "waypoint",
        json!({ "fileId": file, "waypointId": waypoint }),
    );
    assert_eq!(details["name"], "summit");
    assert_eq!(details["sym"], "Summit");
    assert_eq!(details["links"][0]["href"], "https://example.com");

    let exported = app.bytes(
        "export_file",
        json!({ "fileId": file, "time": true, "hr": true, "cad": true, "atemp": true, "power": true, "osm": true }),
    );
    assert_eq!(exported[0], 1);
    assert!(
        String::from_utf8(exported[1..].to_vec())
            .unwrap()
            .contains("<wpt")
    );
    assert_eq!(app.call("exportable_data", json!({ "fileIds": [file] })), 0);

    let stale = app.call(
        "route",
        json!({
            "revision": 12345, "start": 0, "end": 0,
            "lng": [4.4], "lat": [50.8], "ele": [0],
            "attributes": { "surface": { "starts": [0], "values": [0], "names": [] } },
            "anchors": [],
        }),
    );
    assert_eq!(stale["changed"], false);
    assert!(stale["error"].as_str().unwrap().contains("routing buffers"));
}

#[test]
fn keeps_settings_for_the_session() {
    let app = App::new();
    app.call(
        "set_setting",
        json!({ "key": "units", "value": "\"metric\"" }),
    );
    assert_eq!(
        app.call("open_storage", json!({}))["settings"]["units"],
        "\"metric\""
    );
    app.call("delete_setting", json!({ "key": "units" }));
    assert_eq!(app.call("open_storage", json!({}))["settings"], json!({}));
}

#[test]
fn the_files_are_still_there_in_the_next_session() {
    use crate::state::AppState;
    use gpx_engine::api;

    let directory =
        std::env::temp_dir().join(format!("gpx-studio-session-{}", uuid::Uuid::new_v4()));
    let data = std::fs::read("../gpx-rs/data/simple.gpx").unwrap();
    let first = AppState::open(&directory, std::sync::Arc::new(|_, _| {})).unwrap();
    let lengths = [data.len()];
    let names = ["simple".to_string()];
    first.run(move |e| api::load_files(e, &data, &lengths, &names));
    let order = first.read(api::file_order);

    let second = AppState::open(&directory, std::sync::Arc::new(|_, _| {})).unwrap();
    assert_eq!(second.read(api::file_order), order);
    let outcome = second.read(api::Outcome::everything);
    assert_eq!(
        serde_json::to_value(&outcome).unwrap()["added"],
        serde_json::json!(order)
    );
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn only_gpx_files_that_exist_are_taken_from_what_the_system_gives() {
    let directory = std::env::temp_dir().join(format!("gpx-studio-args-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let track = directory.join("track.GPX");
    std::fs::copy("../gpx-rs/data/simple.gpx", &track).unwrap();
    let text = directory.join("notes.txt");
    std::fs::write(&text, "x").unwrap();
    let arguments = [
        "--flag".to_string(),
        track.to_string_lossy().into_owned(),
        text.to_string_lossy().into_owned(),
        directory.join("missing.gpx").to_string_lossy().into_owned(),
    ];
    assert_eq!(crate::gpx_paths(arguments), [track]);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn a_file_opened_with_the_app_is_opened_selected_and_announced() {
    use crate::state::AppState;
    use gpx_engine::api;
    use std::sync::{Arc, Mutex};

    let directory = std::env::temp_dir().join(format!("gpx-studio-open-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let track = directory.join("track.gpx");
    std::fs::copy("../gpx-rs/data/simple.gpx", &track).unwrap();

    let events = Arc::new(Mutex::new(vec![]));
    let sink = events.clone();
    let state = AppState::open(
        directory.join("store"),
        Arc::new(move |name, payload| sink.lock().unwrap().push((name.to_string(), payload))),
    )
    .unwrap();
    state.open_external(vec![track.clone()]);
    // opening it again is a selection, not another file
    state.open_external(vec![track]);

    assert_eq!(state.read(api::file_order).len(), 1);
    assert!(matches!(
        state.read(api::selection),
        api::Selection::File { .. }
    ));
    let events = events.lock().unwrap();
    let opened: Vec<_> = events
        .iter()
        .filter(|(name, _)| name == "files-opened")
        .collect();
    assert_eq!(opened.len(), 2);
    assert_eq!(opened[0].1["added"].as_array().unwrap().len(), 1);
    assert!(opened[1].1["added"].as_array().unwrap().is_empty());
    assert!(events.iter().any(|(name, _)| name == "workspace-changed"));
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn files_are_opened_closed_and_made_in_a_folder() {
    let app = App::new();
    let folder = std::env::temp_dir().join(format!("gpx-tests-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("track.gpx");
    std::fs::copy("../gpx-rs/data/simple.gpx", &path).unwrap();

    // opened from the disk, clean
    let outcome = app.call("open_paths", json!({ "paths": [path] }));
    assert_eq!(outcome["added"].as_array().unwrap().len(), 1);
    let id = outcome["added"][0].as_str().unwrap().to_string();
    let state = app.call("workspace_state", json!({}));
    assert_eq!(state["files"][&id]["dirty"], false);
    assert!(state["files"][&id]["path"].is_string());

    // a new file made in a folder is written there at once, so that the tree shows it
    let created = app.call(
        "new_file",
        json!({ "name": "route", "lng": 4.4, "lat": 50.8, "folder": folder }),
    );
    let new_id = created["added"][0].as_str().unwrap().to_string();
    let state = app.call("workspace_state", json!({}));
    assert_eq!(state["files"][&new_id]["dirty"], false);
    assert!(state["files"][&new_id]["path"].is_string());
    assert!(folder.join("route.gpx").exists());

    // the tree needs an open folder
    assert_eq!(app.call("list_folder", json!({})), json!([]));

    // closing: what is saved goes, what has edits stays unless it is discarded
    app.call("select", json!({ "fileIds": [new_id], "mode": "replace" }));
    app.call("style", json!({ "color": "#ff0000" }));
    app.call("close_files", json!({ "fileIds": [id, new_id] }));
    assert_eq!(app.call("file_order", json!({})), json!([new_id]));
    app.call(
        "close_files",
        json!({ "fileIds": [new_id], "unsaved": "discard" }),
    );
    assert_eq!(app.call("file_order", json!({})), json!([]));
    std::fs::remove_dir_all(folder).unwrap();
}

/// A file that is open from outside of any folder follows the disk too.
#[test]
fn a_file_outside_the_open_folder_is_read_again_when_the_disk_changes() {
    use std::sync::mpsc;
    use std::time::Duration;

    let (events, received) = mpsc::channel();
    let directory = std::env::temp_dir().join(format!("gpx-store-{}", uuid::Uuid::new_v4()));
    let state = crate::state::AppState::open(
        directory.clone(),
        std::sync::Arc::new(move |name, _| {
            let _ = events.send(name.to_string());
        }),
    )
    .unwrap();

    let folder = std::env::temp_dir().join(format!("gpx-tests-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    let path = folder.join("track.gpx");
    std::fs::copy("../gpx-rs/data/simple.gpx", &path).unwrap();
    let opened = path.clone();
    let id = state.core(move |core| {
        let outcome = core.workspace.open_files(&mut core.engine, &[opened], true);
        core.keep_workspace();
        outcome.added()[0].clone()
    });
    let id = uuid::Uuid::parse_str(&id).unwrap();
    // the name comes from the path, which does not change: the content does
    let signature = |state: &crate::state::AppState| {
        state.core(move |core| crate::workspace::signature(&core.engine, id))
    };
    let before = signature(&state);

    std::fs::copy("../gpx-rs/data/with_time.gpx", &path).unwrap();
    // the debounced watcher tells the frontend that the engine changed
    let mut changed = false;
    while let Ok(event) = received.recv_timeout(Duration::from_secs(10)) {
        if event == "engine-changed" {
            changed = true;
            break;
        }
    }
    assert!(changed, "the file was not read again");
    assert_ne!(signature(&state), before);
    std::fs::remove_dir_all(folder).unwrap();
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn files_made_from_a_file_of_the_open_folder_are_written_next_to_it_at_once() {
    let state = crate::state::AppState::temporary();
    let folder = std::env::temp_dir().join(format!("gpx-tests-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(folder.join("sub")).unwrap();
    std::fs::copy("../gpx-rs/data/simple.gpx", folder.join("sub/track.gpx")).unwrap();
    let sub = folder.join("sub");
    let (copied, new_file) = state.core(move |core| {
        core.workspace.open_folder(&mut core.engine, &folder, false);
        let opened = core
            .workspace
            .open_files(&mut core.engine, &[sub.join("track.gpx")], true);
        core.keep_workspace();
        assert_eq!(opened.added().len(), 1);
        let copy = core.creating(None, false, gpx_engine::api::duplicate);
        let fresh = core.creating(None, true, |e| {
            gpx_engine::api::new_file(e, "fresh", None, None, None, false)
        });
        // a copy of the file goes next to it, a new file with nothing selected in the selection
        // of the file that was just made
        (copy, fresh)
    });
    let sub = std::env::temp_dir();
    let _ = sub;
    assert_eq!(copied.added().len(), 1);
    assert_eq!(new_file.added().len(), 1);
    let status = state.core(|core| core.workspace_state());
    assert!(status.files.values().all(|file| !file.dirty));
    let paths: Vec<String> = status
        .files
        .values()
        .map(|file| file.path.clone().unwrap())
        .collect();
    // the copy is in the subfolder, named after the file
    assert!(
        paths.iter().any(|path| path.ends_with("sub/track (2).gpx")),
        "{paths:?}"
    );
    // the new file went where the selected file is
    assert!(
        paths.iter().any(|path| path.ends_with("sub/fresh.gpx")),
        "{paths:?}"
    );
}

#[test]
fn the_parts_of_a_split_are_numbered_from_one() {
    let state = crate::state::AppState::temporary();
    let folder = std::env::temp_dir().join(format!("gpx-tests-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::copy("../gpx-rs/data/simple.gpx", folder.join("track.gpx")).unwrap();
    let root = folder.clone();
    let outcome = state.core(move |core| {
        core.workspace.open_folder(&mut core.engine, &root, false);
        core.workspace
            .open_files(&mut core.engine, &[root.join("track.gpx")], true);
        core.keep_workspace();
        let revision = core.engine.routing().revision;
        core.creating(None, false, |e| {
            gpx_engine::api::split(e, revision, 2, gpx_engine::SplitType::Files)
        })
    });
    assert_eq!(outcome.added().len(), 2, "{:?}", outcome.added());
    let mut names: Vec<String> = std::fs::read_dir(&folder)
        .unwrap()
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    // the file stays, its two parts are numbered from 1
    assert_eq!(names, ["track (1).gpx", "track (2).gpx", "track.gpx"]);
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn files_can_be_reordered() {
    let app = App::new();
    let mut ids = vec![];
    for name in ["a", "b", "c"] {
        let outcome = app.call("new_file", json!({ "name": name }));
        ids.push(outcome["added"][0].as_str().unwrap().to_string());
    }
    assert_eq!(app.call("file_order", json!({})), json!(ids));

    let outcome = app.call("reorder", json!({ "fileIds": [ids[2]], "index": 0 }));
    assert_eq!(outcome["changed"], true);
    assert_eq!(outcome["orderChanged"], true);
    assert_eq!(
        app.call("file_order", json!({})),
        json!([ids[2], ids[0], ids[1]])
    );
}

/// A folder of its own, with GPX files whose name inside is not the name of the file.
fn folder_with(files: &[&str]) -> std::path::PathBuf {
    let folder = std::env::temp_dir().join(format!("gpx-names-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    for name in files {
        std::fs::write(
            folder.join(format!("{name}.gpx")),
            r#"<?xml version="1.0"?><gpx version="1.1" creator="test"><metadata><name>Inside</name></metadata><trk><trkseg><trkpt lat="50.0" lon="4.0"></trkpt><trkpt lat="50.1" lon="4.1"></trkpt></trkseg></trk></gpx>"#,
        )
        .unwrap();
    }
    folder
}

fn name_of(app: &App, id: &str) -> String {
    app.call("file_structure", json!({ "fileId": id }))["name"]
        .as_str()
        .unwrap()
        .to_string()
}

#[test]
fn a_file_is_called_like_its_file_and_renaming_it_renames_the_file() {
    let app = App::new();
    let folder = folder_with(&["outside", "taken"]);
    let outcome = app.call(
        "open_paths",
        json!({ "paths": [folder.join("outside.gpx")] }),
    );
    let id = outcome["added"][0].as_str().unwrap().to_string();

    // the name in the file is not the name of the file: the file wins, and nothing is unsaved
    assert_eq!(name_of(&app, &id), "outside");
    assert_eq!(
        app.call("workspace_state", json!({}))["files"][&id]["dirty"],
        false
    );

    // renaming renames the file on the disk
    app.call("select", json!({ "fileIds": [id], "mode": "replace" }));
    let outcome = app.call("metadata", json!({ "name": "renamed", "desc": "" }));
    assert!(outcome.get("error").is_none());
    assert!(folder.join("renamed.gpx").exists());
    assert!(!folder.join("outside.gpx").exists());
    let path = app.call("workspace_state", json!({}))["files"][&id]["path"].clone();
    assert!(path.as_str().unwrap().ends_with("renamed.gpx"));
    // the file had nothing unsaved: it is written with its new name, and still has nothing unsaved
    let dirty = |app: &App| app.call("workspace_state", json!({}))["files"][&id]["dirty"].clone();
    let inside = |name: &str| std::fs::read_to_string(folder.join(format!("{name}.gpx"))).unwrap();
    assert_eq!(dirty(&app), false);
    assert!(inside("renamed").contains("<name>renamed</name>"));

    // undone and redone, on the disk too, still with nothing unsaved
    app.call("undo", json!({}));
    assert_eq!(name_of(&app, &id), "outside");
    assert!(folder.join("outside.gpx").exists() && !folder.join("renamed.gpx").exists());
    assert_eq!(dirty(&app), false);
    assert!(inside("outside").contains("<name>outside</name>"));
    app.call("redo", json!({}));
    assert_eq!(name_of(&app, &id), "renamed");
    assert!(folder.join("renamed.gpx").exists() && !folder.join("outside.gpx").exists());
    assert_eq!(dirty(&app), false);

    // the name of another file is not taken, nothing changes
    let outcome = app.call("metadata", json!({ "name": "taken", "desc": "" }));
    assert_eq!(outcome["error"], crate::workspace::NAME_TAKEN);
    assert_eq!(name_of(&app, &id), "renamed");
    assert!(folder.join("renamed.gpx").exists());

    // a name is one that a file can have
    app.call("metadata", json!({ "name": "a/b", "desc": "" }));
    assert_eq!(name_of(&app, &id), "a_b");
    assert!(folder.join("a_b.gpx").exists());

    // a file with edits is renamed, but not written: its edits are not saved for it
    app.call("style", json!({ "color": "#ff0000" }));
    assert_eq!(dirty(&app), true);
    app.call("metadata", json!({ "name": "edited", "desc": "" }));
    assert!(folder.join("edited.gpx").exists());
    assert_eq!(dirty(&app), true);
    assert!(!inside("edited").contains("ff0000"));
    app.call("undo", json!({}));
    app.call("undo", json!({}));
    assert_eq!(name_of(&app, &id), "a_b");
    assert_eq!(dirty(&app), false);

    // only the case changes: the same file
    app.call("metadata", json!({ "name": "A_B", "desc": "" }));
    assert_eq!(name_of(&app, &id), "A_B");
    let names: Vec<String> = std::fs::read_dir(&folder)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert!(names.contains(&"A_B.gpx".to_string()));
    assert_eq!(names.len(), 2);
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn a_new_file_written_under_another_name_takes_it() {
    let app = App::new();
    let folder = folder_with(&["route"]);
    // a new file made in the folder is written there at once: route.gpx is taken
    let created = app.call(
        "new_file",
        json!({ "name": "route", "lng": 4.4, "lat": 50.8, "folder": folder }),
    );
    let id = created["added"][0].as_str().unwrap().to_string();
    assert!(folder.join("route (2).gpx").exists());
    assert_eq!(name_of(&app, &id), "route (2)");
    assert_eq!(
        app.call("workspace_state", json!({}))["files"][&id]["dirty"],
        false
    );
    // which is not an edit to undo
    app.call("select", json!({ "fileIds": [id], "mode": "replace" }));
    assert_eq!(app.call("can_undo", json!({})), false);
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn a_file_open_as_a_preview_is_replaced_until_it_is_kept_or_edited() {
    let app = App::new();
    let folder = folder_with(&["a", "b", "c", "d"]);
    let path = |name: &str| folder.join(format!("{name}.gpx"));
    let open = |name: &str, preview: bool| {
        app.call(
            "open_paths",
            json!({ "paths": [path(name)], "preview": preview }),
        )
    };
    let state = |app: &App| app.call("workspace_state", json!({}))["files"].clone();
    let names = |app: &App| -> Vec<String> {
        let order = app.call("file_order", json!({}));
        order
            .as_array()
            .unwrap()
            .iter()
            .map(|id| name_of(app, id.as_str().unwrap()))
            .collect()
    };

    let a = open("a", true)["added"][0].as_str().unwrap().to_string();
    assert_eq!(state(&app)[&a]["preview"], true);
    // the next preview replaces it
    let b = open("b", true)["added"][0].as_str().unwrap().to_string();
    assert_eq!(names(&app), ["b"]);
    assert_eq!(state(&app)[&b]["preview"], true);
    // opened for good (a double click), it stays when another one is previewed
    open("b", false);
    assert_eq!(state(&app)[&b]["preview"], false);
    let c = open("c", true)["added"][0].as_str().unwrap().to_string();
    assert_eq!(names(&app), ["b", "c"]);
    // something done to the preview keeps it too
    app.call("style", json!({ "color": "#ff0000" }));
    assert_eq!(state(&app)[&c]["preview"], false);
    open("d", true);
    assert_eq!(names(&app), ["b", "c", "d"]);
    // several files at once are open for good
    app.call(
        "open_paths",
        json!({ "paths": [path("a"), path("d")], "preview": true }),
    );
    assert_eq!(names(&app), ["b", "c", "d", "a"]);
    let files = state(&app);
    assert!(
        files
            .as_object()
            .unwrap()
            .values()
            .all(|file| file["preview"] == false)
    );
    std::fs::remove_dir_all(folder).unwrap();
}

#[test]
fn the_preview_goes_when_something_else_is_selected_unless_it_was_kept() {
    let app = App::new();
    let folder = folder_with(&["a", "b", "c"]);
    let open = |name: &str, preview: bool| {
        app.call(
            "open_paths",
            json!({ "paths": [folder.join(format!("{name}.gpx"))], "preview": preview }),
        )["added"][0]
            .as_str()
            .map(str::to_string)
    };
    let order = |app: &App| app.call("file_order", json!({})).as_array().unwrap().len();
    let a = open("a", false).unwrap();

    // looked at, then something else is selected: it goes
    let b = open("b", true).unwrap();
    assert_eq!(order(&app), 2);
    app.call("select", json!({ "fileIds": [a], "mode": "replace" }));
    assert_eq!(order(&app), 1);

    // nothing selected: it stays
    open("b", true);
    app.call("select", json!({ "fileIds": [], "mode": "replace" }));
    assert_eq!(order(&app), 2);

    // kept (hidden, its menu opened...): it stays when something else is selected
    let c = open("c", true).unwrap();
    assert_eq!(order(&app), 2, "c replaces b");
    app.call("keep_files", json!({ "fileIds": [c] }));
    assert_eq!(
        app.call("workspace_state", json!({}))["files"][&c]["preview"],
        false
    );
    app.call("select", json!({ "fileIds": [a], "mode": "replace" }));
    assert_eq!(order(&app), 2);
    let _ = b;
    std::fs::remove_dir_all(folder).unwrap();
}
