import type { Readable } from 'svelte/store';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Visibility } from '$lib/file-visibility';
import type { CategoryIntervals } from '$lib/trackpoint-categories';
import type { FileStructure, GlobalStatistics } from 'gpx-rs';

export type {
    Clipboard,
    WaypointDetails,
    TrackpointDetails,
    MoveTarget,
    GlobalStatistics,
    FileStructure,
    FilesUpdate,
    Outcome,
    Selection,
    TrackNode,
    SegmentNode,
    WaypointNode,
} from 'gpx-rs';

/**
 * How a merge puts the selected elements together: `connect` makes a single segment of their
 * trackpoints, `group` keeps them as they are, in the first one.
 */
export type MergeType = 'connect' | 'group';

/** What a split cuts in two: the file, the track or the segment of the trackpoint. */
export type SplitType = 'files' | 'tracks' | 'segments';

/**
 * How elements combine with the current selection: they `replace` it, are `add`ed to it, or are
 * `toggle`d (the ones already selected are removed). Adding and toggling only merge with elements
 * of the same kind in the same place (same file, same track for segments), otherwise the new
 * elements replace the selection.
 */
export type SelectMode = 'replace' | 'add' | 'toggle';

export type SegmentProperties = {
    fileId: string;
    trackId: string;
    segmentId: string;
    trackIndex: number;
    segmentIndex: number;
    /** Changes when the trackpoints of the segment change. */
    rev: string;
    /** Color of the track, or else the base color of the file. */
    color: string;
    /** Only when the track defines it. */
    opacity?: number;
    width?: number;
};

export type WaypointProperties = {
    fileId: string;
    waypointId: string;
    index: number;
    name?: string;
    sym?: string;
};

/** The data of a waypoint to create or to change. Empty strings are fields it does not have. */
export type NewWaypoint = {
    lng: number;
    lat: number;
    ele: number;
    name: string;
    desc: string;
    icon: string;
    link: string;
};

/** Everything the UI knows about one file. */
export type FileState = {
    structure: FileStructure;
    /** Color of the file: the one defined by its tracks if any, otherwise one from the palette. */
    color: string;
    /** Global statistics of the file. */
    statistics: GlobalStatistics;
    /** One LineString feature per track segment, in file order. */
    segments: FeatureCollection<LineString, SegmentProperties>;
    /** One Point feature per waypoint, in file order. */
    waypoints: FeatureCollection<Point, WaypointProperties>;
    /**
     * Visibility the user set explicitly (see `Visibility` and `isHidden`, `isSegmentHidden`,
     * `isWaypointHidden` in `file-visibility`). Hidden elements are still part of the statistics.
     */
    visibility: Visibility;
};

export const EMPTY_STATISTICS: GlobalStatistics = {
    totalDistance: 0,
    elevationGain: 0,
    elevationLoss: 0,
};

/**
 * New trackpoints for `Engine.route`, as arrays with an entry per trackpoint. The OSM attributes
 * are the names of the values (`undefined` when unknown), they are left unknown if missing.
 */
export type RoutePoints = {
    lng: ArrayLike<number>;
    lat: ArrayLike<number>;
    ele: ArrayLike<number>;
    surface?: readonly (string | undefined)[];
    highway?: readonly (string | undefined)[];
    sacScale?: readonly (string | undefined)[];
    mtbScale?: readonly (string | undefined)[];
};

/** Which data of the trackpoints a file is exported with (see `Engine.exportFile`). */
export type ExportOptions = {
    time: boolean;
    hr: boolean;
    cad: boolean;
    atemp: boolean;
    power: boolean;
    /** The OpenStreetMap data: surface, highway, SAC scale and MTB scale. */
    osm: boolean;
    /**
     * Writes the segments as routes instead of tracks: the anchors are the route points, and the
     * trackpoints between them the points of their path (which only keep their position).
     */
    asRoute: boolean;
};

export const ALL_EXPORT_OPTIONS: ExportOptions = {
    time: true,
    hr: true,
    cad: true,
    atemp: true,
    power: true,
    osm: true,
    asRoute: false,
};

/**
 * Timestamp of the trackpoints that have none, in `SelectionStatistics.timestamps` (the smallest
 * 64-bit integer, like `NO_TIME` in the engine).
 */
export const NO_TIME = -(2n ** 63n);

/**
 * Statistics of the selection that are only read from the engine when something asks for them
 * (see `Engine.requestStatistics`). A metric can bring several arrays.
 */
export type StatisticsMetric =
    | 'speed'
    | 'hr'
    | 'cad'
    | 'atemp'
    | 'power'
    /** `slopeSegmentSlope` and `slopeSegmentDistance`. */
    | 'slopeSegment'
    | 'surface'
    /** `highway`, `sacScale` and `mtbScale`. */
    | 'highway'
    /** `anchors`. */
    | 'anchors';

/**
 * The anchors of the routing tool among the trackpoints of the selection: the points that can be
 * dragged to reroute a segment, which are few of them. The arrays are as long as the number of
 * anchors, in the order of the trackpoints.
 */
export type SelectionAnchors = {
    /** Index of the anchor in the trackpoints of the selection. */
    indices: Uint32Array;
    /** Lowest map zoom level at which the anchor is shown (0 for the ends of the segments). */
    zooms: Uint8Array;
    /**
     * Index of the first trackpoint of each segment of the selection that has some: anchors that
     * are between two consecutive starts belong to the same segment.
     */
    segmentStarts: Uint32Array;
    /** Id of each of these segments. */
    segmentIds: string[];
    /**
     * Changes when the selected segments, or their trackpoints, change. The indices in the
     * selection (of trackpoints, of anchors) only mean something for one revision, which commands
     * that use them have to give.
     */
    revision: number;
};

/**
 * The statistics of the selection: its global statistics, and the values at each of its
 * trackpoints (all the selected segments, one after the other). The arrays are copies.
 *
 * Distances are cumulative over the whole selection. Distances are in km, speeds in km/h, times in
 * ms (timestamps since the epoch, as 64-bit integers), elevations in m and slopes in %.
 *
 * The values of the trackpoints that the selection does not have at all (for example the heart
 * rates, when no trackpoint has any) are `undefined`, and so are the ones that were not requested
 * (see `StatisticsMetric`). Otherwise they have one entry per trackpoint: missing timestamps are
 * `NO_TIME`, missing measures are NaN.
 */
export type SelectionStatistics = {
    global: GlobalStatistics;
    /** Number of trackpoints. */
    length: number;
    totalDistance: Float64Array;
    /** Slope at the trackpoint. */
    slope: Float64Array;
    lng: Float64Array;
    lat: Float64Array;
    ele: Float64Array;
    timestamps?: BigInt64Array;

    // the following need to be requested
    speed?: Float64Array;
    hr?: Float64Array;
    cad?: Float64Array;
    atemp?: Float64Array;
    power?: Float64Array;
    /** Slope and length (km) of the smoothed elevation segment the trackpoint belongs to. */
    slopeSegmentSlope?: Float64Array;
    slopeSegmentDistance?: Float64Array;
    surface?: CategoryIntervals;
    highway?: CategoryIntervals;
    /** SAC hiking scale. */
    sacScale?: CategoryIntervals;
    /** Mountain biking scale. */
    mtbScale?: CategoryIntervals;
    anchors?: SelectionAnchors;

    /**
     * Global statistics of the trackpoints from `start` to `end` (both included), for example
     * the part of the elevation profile that was dragged over. `undefined` if the range is not
     * in the selection, or if the selection is not the current one anymore.
     */
    slice(start: number, end: number): GlobalStatistics | undefined;
};

export const EMPTY_SELECTION_STATISTICS: SelectionStatistics = {
    global: EMPTY_STATISTICS,
    length: 0,
    totalDistance: new Float64Array(),
    slope: new Float64Array(),
    lng: new Float64Array(),
    lat: new Float64Array(),
    ele: new Float64Array(),
    slice: () => undefined,
};

export type StatisticsRequest = {
    /** Replaces the metrics needed by this consumer. */
    set(metrics: Iterable<StatisticsMetric>): void;
    /** The consumer does not need any metric anymore. */
    release(): void;
};

export type FileStatesCallback = (files: Map<string, Readable<FileState>>) => void;
