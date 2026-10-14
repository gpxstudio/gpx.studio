//! The commands, called the way the frontend calls them (through the IPC of Tauri), on the sample
//! files of the engine.

use serde_json::{json, Value};
use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{ipc::CallbackFn, ipc::InvokeBody, ipc::InvokeResponseBody, WebviewWindow};

struct App(WebviewWindow<tauri::test::MockRuntime>);

impl App {
    fn new() -> Self {
        let app = crate::with_engine(mock_builder())
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
            let file = std::fs::read(format!("../gpx-rs/engine/data/{name}.gpx")).unwrap();
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
        .chunks_exact(8)
        .map(|chunk| f64::from_le_bytes(chunk.try_into().unwrap()))
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
    assert_eq!(app.call("can_undo", json!({})), true);

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

    app.call("undo", json!({}));
    assert_eq!(
        app.call("file_structure", json!({ "fileId": id }))["name"],
        "route"
    );
    assert_eq!(app.call("can_redo", json!({})), true);
    app.call("undo", json!({}));
    assert_eq!(app.call("file_order", json!({})), json!([]));

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
        json!({ "fileId": file, "time": true, "hr": true, "cad": true, "atemp": true, "power": true, "osm": true, "asRoute": false }),
    );
    assert_eq!(exported[0], 1);
    assert!(String::from_utf8(exported[1..].to_vec())
        .unwrap()
        .contains("<wpt"));
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
