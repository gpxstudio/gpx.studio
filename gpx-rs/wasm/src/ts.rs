//! The TypeScript types of the JS objects, which the functions declare in their signatures.

use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const ROUTE_TS: &str = r#"
/**
 * An OSM attribute of the new trackpoints of a route, as the intervals of trackpoints that share
 * a value: `starts[i]` is the index of the first trackpoint of the interval `i`, and `values[i]`
 * its value, 0 when unknown, else 1 + the index of its name in `names`.
 */
export interface RouteCategory {
    starts: Uint32Array;
    values: Uint8Array;
    names: string[];
}
/** The attributes of the new trackpoints of a route. The ones that are missing are unknown. */
export interface RouteAttributes {
    surface?: RouteCategory;
    highway?: RouteCategory;
    sacScale?: RouteCategory;
    mtbScale?: RouteCategory;
}
"#;

#[wasm_bindgen(typescript_custom_section)]
const FILE_STRUCTURE_TS: &str = r#"
export type Selection =
    | { type: 'empty' }
    | { type: 'file'; fileIds: string[] }
    | { type: 'track'; fileId: string; trackIds: string[] }
    | { type: 'segment'; fileId: string; trackId: string; segmentIds: string[] }
    | { type: 'waypoints'; fileId: string }
    | { type: 'waypoint'; fileId: string; waypointIds: string[] };
/**
 * Where moved elements go: a list of the file tree and the position in it, counted among the
 * elements of the list that are not moved.
 */
export type MoveTarget =
    | { type: 'files'; index: number }
    | { type: 'tracks'; fileId: string; index: number }
    | { type: 'segments'; fileId: string; trackId: string; index: number }
    | { type: 'waypoints'; fileId: string; index: number };
/** All the data of a waypoint. The fields it does not have are absent. */
export interface WaypointDetails {
    id: string;
    lng: number;
    lat: number;
    ele: number;
    /** ms since epoch */
    time?: number;
    name?: string;
    desc?: string;
    cmt?: string;
    /** The links of the waypoint, absent when it has none. */
    links?: { href: string; text?: string }[];
    sym?: string;
}
/** The position, elevation and time of a trackpoint. */
export interface TrackpointDetails {
    lng: number;
    lat: number;
    ele: number;
    /** ms since epoch */
    time?: number;
}
/** What was copied or cut, to be pasted: the kind of the elements and their ids. */
export interface Clipboard {
    type: 'files' | 'tracks' | 'segments' | 'waypoints';
    ids: string[];
    cut: boolean;
}
/** What changed in the files, the selection and the clipboard. */
export interface FilesUpdate {
    orderChanged: boolean;
    selectionChanged: boolean;
    clipboardChanged: boolean;
    /** Files to read the structure of. */
    added: string[];
    /** Files whose structure changed: reread it. */
    modified: string[];
    /** Files that do not exist anymore: drop their structure. */
    removed: string[];
}
/**
 * What a call that edits the files or changes the selection did. `changed` is whether anything
 * did; `error` tells why not (nothing to do, invalid data, or what is wrong with the arguments).
 * Apply the update to what is kept of the files before the next call.
 */
export interface Outcome extends FilesUpdate {
    changed: boolean;
    error?: string;
}
/** What opening the storage found. */
export interface StorageOpened {
    /** The settings, as JSON strings by key. */
    settings: Record<string, string>;
    /** The files that were restored are the added ones. */
    outcome: Outcome;
    /** Some of what is stored was written by a newer version: nothing is saved. */
    readOnly: boolean;
    /** How many stored files could not be read, and are dropped at the next save. */
    unreadable: number;
}
export interface FileStructure {
    id: string;
    name: string;
    desc?: string;
    tracks: TrackNode[];
    waypoints: WaypointNode[];
    /** Changes when the waypoints of the file change: refetch their coordinates. */
    waypointsRev: string;
}
/**
 * Global statistics of a file, of the selection, or of a part of it. The optional fields are
 * absent when there is no data for them (no timestamps, no heart rate...).
 */
export interface GlobalStatistics {
    /** km */
    totalDistance: number;
    movingDistance?: number;
    /** seconds */
    totalTime?: number;
    movingTime?: number;
    elevationGain: number;
    elevationLoss: number;
    /** ms since epoch */
    startTime?: number;
    endTime?: number;
    /** km/h */
    totalSpeed?: number;
    movingSpeed?: number;
    /** Average and number of trackpoints having the measure. */
    hr?: { avg: number; count: number };
    cad?: { avg: number; count: number };
    atemp?: { avg: number; count: number };
    power?: { avg: number; count: number };
    /** Absent when there are no trackpoints. */
    bounds?: { west: number; south: number; east: number; north: number };
}
export interface TrackNode {
    id: string;
    name?: string;
    desc?: string;
    /** Style of the track, only present when the file defines it. */
    color?: string;
    opacity?: number;
    width?: number;
    segments: SegmentNode[];
}
export interface SegmentNode {
    id: string;
    /** Changes when the trackpoints of the segment change: refetch their coordinates. */
    rev: string;
    /** Number of trackpoints. */
    length: number;
}
export interface WaypointNode {
    id: string;
    name?: string;
    sym?: string;
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Selection")]
    pub type Selection;
    #[wasm_bindgen(typescript_type = "WaypointDetails | undefined")]
    pub type WaypointDetails;
    #[wasm_bindgen(typescript_type = "TrackpointDetails | undefined")]
    pub type TrackpointDetails;
    #[wasm_bindgen(typescript_type = "MoveTarget")]
    pub type MoveTarget;

    #[wasm_bindgen(typescript_type = "RouteAttributes")]
    pub type RouteAttributes;
    #[wasm_bindgen(typescript_type = "Clipboard | undefined")]
    pub type Clipboard;
    #[wasm_bindgen(typescript_type = "Outcome")]
    pub type Outcome;
    #[wasm_bindgen(typescript_type = "StorageOpened")]
    pub type StorageOpened;
    #[wasm_bindgen(typescript_type = "FileStructure | undefined")]
    pub type FileStructure;
    #[wasm_bindgen(typescript_type = "GlobalStatistics | undefined")]
    pub type GlobalStatistics;
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type FileOrder;
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type StringList;
}
