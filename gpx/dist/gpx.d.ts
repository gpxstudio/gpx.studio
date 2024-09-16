import { Coordinates, GPXFileAttributes, GPXFileType, LineStyleExtension, Link, Metadata, RouteType, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, WaypointType } from "./types";
import { immerable } from "immer";
export declare abstract class GPXTreeElement<T extends GPXTreeElement<any>> {
    _data: {
        [key: string]: any;
    };
    abstract isLeaf(): boolean;
    abstract get children(): Array<T>;
    abstract getNumberOfTrackPoints(): number;
    abstract getStartTimestamp(): Date | undefined;
    abstract getEndTimestamp(): Date | undefined;
    abstract getStatistics(): GPXStatistics;
    abstract getSegments(): TrackSegment[];
    abstract getTrackPoints(): TrackPoint[];
    abstract toGeoJSON(): GeoJSON.Feature | GeoJSON.Feature[] | GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];
    abstract _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): any;
}
export type AnyGPXTreeElement = GPXTreeElement<GPXTreeElement<any>>;
declare abstract class GPXTreeNode<T extends GPXTreeElement<any>> extends GPXTreeElement<T> {
    isLeaf(): boolean;
    getNumberOfTrackPoints(): number;
    getStartTimestamp(): Date | undefined;
    getEndTimestamp(): Date | undefined;
    getStatistics(): GPXStatistics;
    getSegments(): TrackSegment[];
    getTrackPoints(): TrackPoint[];
    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void;
}
declare abstract class GPXTreeLeaf extends GPXTreeElement<GPXTreeLeaf> {
    isLeaf(): boolean;
    get children(): Array<GPXTreeLeaf>;
}
export declare class GPXFile extends GPXTreeNode<Track> {
    [immerable]: boolean;
    attributes: GPXFileAttributes;
    metadata: Metadata;
    wpt: Waypoint[];
    trk: Track[];
    rte: RouteType[];
    constructor(gpx?: GPXFileType & {
        _data?: any;
    } | GPXFile);
    get children(): Array<Track>;
    getSegment(trackIndex: number, segmentIndex: number): TrackSegment;
    forEachSegment(callback: (segment: TrackSegment, trackIndex: number, segmentIndex: number) => void): void;
    getStyle(): MergedLineStyles;
    clone(): GPXFile;
    toGeoJSON(): GeoJSON.FeatureCollection;
    toGPXFileType(exclude?: string[]): GPXFileType;
    replaceTracks(start: number, end: number, tracks: Track[]): void;
    replaceTrackSegments(trackIndex: number, start: number, end: number, segments: TrackSegment[]): void;
    replaceTrackPoints(trackIndex: number, segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date): void;
    replaceWaypoints(start: number, end: number, waypoints: Waypoint[]): void;
    reverse(): void;
    reverseTrack(trackIndex: number): void;
    reverseTrackSegment(trackIndex: number, segmentIndex: number): void;
    roundTrip(): void;
    roundTripTrack(trackIndex: number): void;
    roundTripTrackSegment(trackIndex: number, segmentIndex: number): void;
    crop(start: number, end: number, trackIndices?: number[], segmentIndices?: number[]): void;
    clean(bounds: [Coordinates, Coordinates], inside: boolean, deleteTrackPoints: boolean, deleteWaypoints: boolean, trackIndices?: number[], segmentIndices?: number[], waypointIndices?: number[]): void;
    changeTimestamps(startTime: Date, speed: number, ratio: number, trackIndex?: number, segmentIndex?: number): void;
    createArtificialTimestamps(startTime: Date, totalTime: number, trackIndex?: number, segmentIndex?: number): void;
    addElevation(elevations: number[], trackIndices?: number[], segmentIndices?: number[], waypointIndices?: number[]): void;
    setStyle(style: LineStyleExtension): void;
    setHidden(hidden: boolean, trackIndices?: number[], segmentIndices?: number[]): void;
    setHiddenWaypoints(hidden: boolean, waypointIndices?: number[]): void;
}
export declare class Track extends GPXTreeNode<TrackSegment> {
    [immerable]: boolean;
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    extensions?: TrackExtensions;
    trkseg: TrackSegment[];
    constructor(track?: TrackType & {
        _data?: any;
    } | Track);
    get children(): Array<TrackSegment>;
    clone(): Track;
    getStyle(): LineStyleExtension | undefined;
    toGeoJSON(): GeoJSON.Feature[];
    toTrackType(exclude?: string[]): TrackType;
    replaceTrackSegments(start: number, end: number, segments: TrackSegment[]): void;
    replaceTrackPoints(segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date): void;
    reverseTrackSegment(segmentIndex: number): void;
    roundTrip(): void;
    roundTripTrackSegment(segmentIndex: number): void;
    crop(start: number, end: number, segmentIndices?: number[]): void;
    clean(bounds: [Coordinates, Coordinates], inside: boolean, segmentIndices?: number[]): void;
    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint, segmentIndex?: number): void;
    createArtificialTimestamps(startTime: Date, totalTime: number, lastPoint: TrackPoint | undefined, segmentIndex?: number): void;
    setStyle(style: LineStyleExtension, force?: boolean): void;
    setHidden(hidden: boolean, segmentIndices?: number[]): void;
}
export declare class TrackSegment extends GPXTreeLeaf {
    [immerable]: boolean;
    trkpt: TrackPoint[];
    constructor(segment?: TrackSegmentType & {
        _data?: any;
    } | TrackSegment);
    _computeStatistics(): GPXStatistics;
    _computeSmoothedElevation(): number[];
    _computeSlope(): number[];
    _computeSlopeSegments(statistics: GPXStatistics): [number[], number[]];
    getNumberOfTrackPoints(): number;
    getStartTimestamp(): Date | undefined;
    getEndTimestamp(): Date | undefined;
    getStatistics(): GPXStatistics;
    getSegments(): TrackSegment[];
    getTrackPoints(): TrackPoint[];
    toGeoJSON(): GeoJSON.Feature;
    toTrackSegmentType(exclude?: string[]): TrackSegmentType;
    clone(): TrackSegment;
    replaceTrackPoints(start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date): void;
    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void;
    roundTrip(): void;
    crop(start: number, end: number): void;
    clean(bounds: [Coordinates, Coordinates], inside: boolean): void;
    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint): void;
    createArtificialTimestamps(startTime: Date, totalTime: number, lastPoint: TrackPoint | undefined): void;
    setHidden(hidden: boolean): void;
}
export declare class TrackPoint {
    [immerable]: boolean;
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;
    _data: {
        [key: string]: any;
    };
    constructor(point: TrackPointType & {
        _data?: any;
    } | TrackPoint);
    getCoordinates(): Coordinates;
    setCoordinates(coordinates: Coordinates): void;
    getLatitude(): number;
    getLongitude(): number;
    getTemperature(): number;
    getHeartRate(): number;
    getCadence(): number;
    getPower(): number;
    getSurface(): string;
    setSurface(surface: string): void;
    toTrackPointType(exclude?: string[]): TrackPointType;
    clone(): TrackPoint;
}
export declare class Waypoint {
    [immerable]: boolean;
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    name?: string;
    cmt?: string;
    desc?: string;
    link?: Link;
    sym?: string;
    type?: string;
    _data: {
        [key: string]: any;
    };
    constructor(waypoint: WaypointType & {
        _data?: any;
    } | Waypoint);
    getCoordinates(): Coordinates;
    setCoordinates(coordinates: Coordinates): void;
    getLatitude(): number;
    getLongitude(): number;
    toWaypointType(exclude?: string[]): WaypointType;
    clone(): Waypoint;
    setHidden(hidden: boolean): void;
}
export declare class GPXStatistics {
    global: {
        distance: {
            moving: number;
            total: number;
        };
        time: {
            start: Date | undefined;
            end: Date | undefined;
            moving: number;
            total: number;
        };
        speed: {
            moving: number;
            total: number;
        };
        elevation: {
            gain: number;
            loss: number;
        };
        bounds: {
            southWest: Coordinates;
            northEast: Coordinates;
        };
        atemp: {
            avg: number;
            count: number;
        };
        hr: {
            avg: number;
            count: number;
        };
        cad: {
            avg: number;
            count: number;
        };
        power: {
            avg: number;
            count: number;
        };
    };
    local: {
        points: TrackPoint[];
        distance: {
            moving: number[];
            total: number[];
        };
        time: {
            moving: number[];
            total: number[];
        };
        speed: number[];
        elevation: {
            smoothed: number[];
            gain: number[];
            loss: number[];
        };
        slope: {
            at: number[];
            segment: number[];
            length: number[];
        };
    };
    constructor();
    mergeWith(other: GPXStatistics): void;
    slice(start: number, end: number): GPXStatistics;
}
export declare function distance(coord1: TrackPoint | Coordinates, coord2: TrackPoint | Coordinates): number;
export type MergedLineStyles = {
    color: string[];
    opacity: number[];
    weight: number[];
};
export {};
