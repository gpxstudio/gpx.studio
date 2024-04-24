import { Coordinates, GPXFileAttributes, GPXFileType, Link, Metadata, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, WaypointType } from "./types";

function cloneJSON<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
}

// An abstract class that groups functions that need to be computed recursively in the GPX file hierarchy
abstract class GPXTreeElement<T extends GPXTreeElement<any>> {
    statistics: GPXStatistics;

    abstract isLeaf(): boolean;
    abstract getChildren(): T[];

    abstract computeStatistics(): GPXStatistics;

    abstract append(points: TrackPoint[]): void;
    abstract reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void;

    abstract getStartTimestamp(): Date;
    abstract getEndTimestamp(): Date;
    abstract getTrackPoints(): TrackPoint[];
    abstract getTrackPointsAndStatistics(): { points: TrackPoint[], statistics: TrackPointStatistics };

    abstract toGeoJSON(): any;
}

// An abstract class that can be extended to facilitate functions working similarly with Tracks and TrackSegments
abstract class GPXTreeNode<T extends GPXTreeElement<any>> extends GPXTreeElement<T> {
    isLeaf(): boolean {
        return false;
    }

    computeStatistics(): GPXStatistics {
        let statistics = new GPXStatistics();

        for (let child of this.getChildren()) {
            statistics.mergeWith(child.computeStatistics());
        }

        this.statistics = statistics;

        return statistics;
    }

    append(points: TrackPoint[]): void {
        let children = this.getChildren();

        if (children.length === 0) {
            return;
        }

        children[children.length - 1].append(points);
    }

    reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void {
        const children = this.getChildren();

        if (!originalNextTimestamp && !newPreviousTimestamp) {
            originalNextTimestamp = children[children.length - 1].getEndTimestamp();
            newPreviousTimestamp = children[0].getStartTimestamp();
        }

        children.reverse();

        for (let i = 0; i < children.length; i++) {
            let originalStartTimestamp = children[i].getStartTimestamp();

            children[i].reverse(originalNextTimestamp, newPreviousTimestamp);

            originalNextTimestamp = originalStartTimestamp;
            newPreviousTimestamp = children[i].getEndTimestamp();
        }
    }

    getStartTimestamp(): Date {
        return this.getChildren()[0].getStartTimestamp();
    }

    getEndTimestamp(): Date {
        return this.getChildren()[this.getChildren().length - 1].getEndTimestamp();
    }

    getTrackPoints(): TrackPoint[] {
        return this.getChildren().flatMap((child) => child.getTrackPoints());
    }

    getTrackPointsAndStatistics(): { points: TrackPoint[]; statistics: TrackPointStatistics; } {
        let points: TrackPoint[] = [];
        let statistics: TrackPointStatistics = {
            distance: [],
            time: [],
            speed: [],
            elevation: {
                smoothed: [],
                gain: [],
                loss: [],
            },
            slope: [],
        };

        let current = new GPXStatistics();
        for (let child of this.getChildren()) {
            let childData = child.getTrackPointsAndStatistics();
            points = points.concat(childData.points);

            statistics.distance = statistics.distance.concat(childData.statistics.distance.map((distance) => distance + current.distance.total));
            statistics.time = statistics.time.concat(childData.statistics.time.map((time) => time + current.time.total));
            statistics.elevation.gain = statistics.elevation.gain.concat(childData.statistics.elevation.gain.map((gain) => gain + current.elevation.gain));
            statistics.elevation.loss = statistics.elevation.loss.concat(childData.statistics.elevation.loss.map((loss) => loss + current.elevation.loss));

            statistics.speed = statistics.speed.concat(childData.statistics.speed);
            statistics.elevation.smoothed = statistics.elevation.smoothed.concat(childData.statistics.elevation.smoothed);
            statistics.slope = statistics.slope.concat(childData.statistics.slope);

            current.mergeWith(child.statistics);
        }

        return { points, statistics };
    }
}

// An abstract class that TrackSegment extends to implement the GPXTreeElement interface
abstract class GPXTreeLeaf extends GPXTreeElement<GPXTreeLeaf> {
    isLeaf(): boolean {
        return true;
    }

    getChildren(): GPXTreeLeaf[] {
        return [];
    }
}

// A class that represents a set of GPX files
export class GPXFiles extends GPXTreeNode<GPXFile> {
    files: GPXFile[];

    constructor(files: GPXFile[]) {
        super();
        this.files = files;

        this.statistics = new GPXStatistics();
        for (let file of files) {
            this.statistics.mergeWith(file.statistics);
        }
    }

    getChildren(): GPXFile[] {
        return this.files;
    }

    toGeoJSON(): any {
        return this.getChildren().map((child) => child.toGeoJSON());
    }
}

// A class that represents a GPX file
export class GPXFile extends GPXTreeNode<Track>{
    attributes: GPXFileAttributes;
    metadata: Metadata;
    wpt: Waypoint[];
    trk: Track[];

    constructor(gpx: GPXFileType | GPXFile) {
        super();
        this.attributes = cloneJSON(gpx.attributes);
        this.metadata = cloneJSON(gpx.metadata);
        this.wpt = gpx.wpt ? gpx.wpt.map((waypoint) => new Waypoint(waypoint)) : [];
        this.trk = gpx.trk ? gpx.trk.map((track) => new Track(track)) : [];

        this.computeStatistics();
    }

    getChildren(): Track[] {
        return this.trk;
    }

    clone(): GPXFile {
        return new GPXFile(structuredClone(this));
    }

    toGeoJSON(): any {
        return {
            type: "FeatureCollection",
            features: this.getChildren().flatMap((child) => child.toGeoJSON())
        };
    }

    toGPXFileType(): GPXFileType {
        return {
            attributes: this.attributes,
            metadata: this.metadata,
            wpt: this.wpt,
            trk: this.trk.map((track) => track.toTrackType())
        };
    }
};

// A class that represents a Track in a GPX file
export class Track extends GPXTreeNode<TrackSegment> {
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    trkseg: TrackSegment[];
    extensions?: TrackExtensions;

    constructor(track: TrackType | Track) {
        super();
        this.name = track.name;
        this.cmt = track.cmt;
        this.desc = track.desc;
        this.src = track.src;
        this.link = cloneJSON(track.link);
        this.type = track.type;
        this.trkseg = track.trkseg ? track.trkseg.map((seg) => new TrackSegment(seg)) : [];
        this.extensions = cloneJSON(track.extensions);
    }

    getChildren(): TrackSegment[] {
        return this.trkseg;
    }

    toGeoJSON(): any {
        return this.getChildren().map((child) => {
            let geoJSON = child.toGeoJSON();
            if (this.extensions && this.extensions['gpx_style:line']) {
                if (this.extensions['gpx_style:line'].color) {
                    geoJSON.properties['color'] = this.extensions['gpx_style:line'].color;
                }
                if (this.extensions['gpx_style:line'].opacity) {
                    geoJSON.properties['opacity'] = this.extensions['gpx_style:line'].opacity;
                }
                if (this.extensions['gpx_style:line'].weight) {
                    geoJSON.properties['weight'] = this.extensions['gpx_style:line'].weight;
                }
            }
            return geoJSON;
        });
    }

    toTrackType(): TrackType {
        return {
            name: this.name,
            cmt: this.cmt,
            desc: this.desc,
            src: this.src,
            link: this.link,
            type: this.type,
            trkseg: this.trkseg.map((seg) => seg.toTrackSegmentType()),
            extensions: this.extensions,
        };
    }

    clone(): Track {
        return new Track(structuredClone(this));
    }
};

// A class that represents a TrackSegment in a GPX file
export class TrackSegment extends GPXTreeLeaf {
    trkpt: TrackPoint[];
    trkptStatistics: TrackPointStatistics;

    constructor(segment: TrackSegmentType | TrackSegment) {
        super();
        this.trkpt = segment.trkpt.map((point) => new TrackPoint(point));
    }

    computeStatistics(): GPXStatistics {
        let statistics = new GPXStatistics();
        let trkptStatistics: TrackPointStatistics = {
            distance: [],
            time: [],
            speed: [],
            elevation: {
                smoothed: [],
                gain: [],
                loss: [],
            },
            slope: [],
        };

        trkptStatistics.elevation.smoothed = this.computeSmoothedElevation();
        trkptStatistics.slope = this.computeSlope();

        const points = this.trkpt;
        for (let i = 0; i < points.length; i++) {

            // distance
            let dist = 0;
            if (i > 0) {
                dist = distance(points[i - 1].getCoordinates(), points[i].getCoordinates()) / 1000;

                statistics.distance.total += dist;
            }

            trkptStatistics.distance.push(statistics.distance.total);

            // elevation
            if (i > 0) {
                const ele = trkptStatistics.elevation.smoothed[i] - trkptStatistics.elevation.smoothed[i - 1];
                if (ele > 0) {
                    statistics.elevation.gain += ele;
                } else {
                    statistics.elevation.loss -= ele;
                }
            }

            trkptStatistics.elevation.gain.push(statistics.elevation.gain);
            trkptStatistics.elevation.loss.push(statistics.elevation.loss);

            // time
            if (points[0].time !== undefined && points[i].time !== undefined) {
                const time = (points[i].time.getTime() - points[0].time.getTime()) / 1000;

                trkptStatistics.time.push(time);
            }

            // speed
            let speed = 0;
            if (i > 0 && points[i - 1].time !== undefined && points[i].time !== undefined) {
                const time = (points[i].time.getTime() - points[i - 1].time.getTime()) / 1000;
                speed = dist / (time / 3600);

                if (speed >= 0.5) {
                    statistics.distance.moving += dist;
                    statistics.time.moving += time;
                }
            }

            // bounds
            statistics.bounds.southWest.lat = Math.min(statistics.bounds.southWest.lat, points[i].attributes.lat);
            statistics.bounds.southWest.lon = Math.max(statistics.bounds.southWest.lon, points[i].attributes.lon);
            statistics.bounds.northEast.lat = Math.max(statistics.bounds.northEast.lat, points[i].attributes.lat);
            statistics.bounds.northEast.lon = Math.min(statistics.bounds.northEast.lon, points[i].attributes.lon);
        }

        statistics.time.total = trkptStatistics.time[trkptStatistics.time.length - 1];
        statistics.speed.total = statistics.distance.total / (statistics.time.total / 3600);
        statistics.speed.moving = statistics.distance.moving / (statistics.time.moving / 3600);

        trkptStatistics.speed = distanceWindowSmoothingWithDistanceAccumulator(points, 200, (accumulated, start, end) => (points[start].time && points[end].time) ? 3600 * accumulated / (points[end].time.getTime() - points[start].time.getTime()) : undefined);

        this.statistics = statistics;
        this.trkptStatistics = trkptStatistics;

        return statistics;
    }

    computeSmoothedElevation(): number[] {
        const points = this.trkpt;

        let smoothed = distanceWindowSmoothing(points, 100, (index) => points[index].ele, (accumulated, start, end) => accumulated / (end - start + 1));

        if (points.length > 0) {
            smoothed[0] = points[0].ele;
            smoothed[points.length - 1] = points[points.length - 1].ele;
        }

        return smoothed;
    }

    computeSlope(): number[] {
        const points = this.trkpt;

        return distanceWindowSmoothingWithDistanceAccumulator(points, 50, (accumulated, start, end) => 100 * (points[end].ele - points[start].ele) / accumulated);
    }

    append(points: TrackPoint[]): void {
        this.trkpt = this.trkpt.concat(points);
        //this.computeStatistics();
    }

    reverse(originalNextTimestamp: Date | undefined, newPreviousTimestamp: Date | undefined): void {
        if (originalNextTimestamp !== undefined && newPreviousTimestamp !== undefined) {
            let originalEndTimestamp = this.getEndTimestamp();
            let newStartTimestamp = new Date(
                newPreviousTimestamp.getTime() + originalNextTimestamp.getTime() - originalEndTimestamp.getTime()
            );

            this.trkpt.reverse();

            for (let i = 0; i < this.trkpt.length; i++) {
                this.trkpt[i].time = new Date(
                    newStartTimestamp.getTime() + (originalEndTimestamp.getTime() - this.trkpt[i].time.getTime())
                );
            }
        } else {
            this.trkpt.reverse();
        }
    }

    getStartTimestamp(): Date {
        return this.trkpt[0].time;
    }

    getEndTimestamp(): Date {
        return this.trkpt[this.trkpt.length - 1].time;
    }

    getTrackPoints(): TrackPoint[] {
        return this.trkpt;
    }

    getTrackPointsAndStatistics(): { points: TrackPoint[], statistics: TrackPointStatistics } {
        return {
            points: this.trkpt,
            statistics: this.trkptStatistics
        };
    }

    toGeoJSON(): any {
        return {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: this.trkpt.map((point) => [point.attributes.lon, point.attributes.lat])
            },
            properties: {}
        };
    }

    toTrackSegmentType(): TrackSegmentType {
        return {
            trkpt: this.trkpt
        };
    }

    clone(): TrackSegment {
        return new TrackSegment(structuredClone(this));
    }
};

export class TrackPoint {
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;

    constructor(point: TrackPointType | TrackPoint) {
        this.attributes = cloneJSON(point.attributes);
        this.ele = point.ele;
        if (point.time) {
            this.time = new Date(point.time.getTime());
        }
        this.extensions = cloneJSON(point.extensions);
    }

    getCoordinates(): Coordinates {
        return this.attributes;
    }

    getLatitude(): number {
        return this.attributes.lat;
    }

    getLongitude(): number {
        return this.attributes.lon;
    }

    getHeartRate(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] : undefined;
    }

    getCadence(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] : undefined;
    }

    getTemperature(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] : undefined;
    }

    getPower(): number {
        return this.extensions && this.extensions["gpxpx:PowerExtension"] && this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] ? this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] : undefined;
    }

    getSurface(): string {
        return this.extensions && this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"].surface ? this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"].surface : undefined;
    }
};

export class Waypoint {
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    name?: string;
    cmt?: string;
    desc?: string;
    link?: Link;
    sym?: string;
    type?: string;

    constructor(waypoint: WaypointType | Waypoint) {
        this.attributes = cloneJSON(waypoint.attributes);
        this.ele = waypoint.ele;
        if (waypoint.time) {
            this.time = new Date(waypoint.time.getTime());
        }
        this.name = waypoint.name;
        this.cmt = waypoint.cmt;
        this.desc = waypoint.desc;
        this.link = cloneJSON(waypoint.link);
        this.sym = waypoint.sym;
        this.type = waypoint.type;
    }
}

export class GPXStatistics {
    distance: {
        moving: number;
        total: number;
    };
    time: {
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
    }

    constructor() {
        this.distance = {
            moving: 0,
            total: 0,
        };
        this.time = {
            moving: 0,
            total: 0,
        };
        this.speed = {
            moving: 0,
            total: 0,
        };
        this.elevation = {
            gain: 0,
            loss: 0,
        };
        this.bounds = {
            southWest: {
                lat: 90,
                lon: -180,
            },
            northEast: {
                lat: -90,
                lon: 180,
            },
        };
    }

    mergeWith(other: GPXStatistics): void {
        this.distance.total += other.distance.total;
        this.distance.moving += other.distance.moving;

        this.time.total += other.time.total;
        this.time.moving += other.time.moving;

        this.speed.moving = this.distance.moving / (this.time.moving / 3600);
        this.speed.total = this.distance.total / (this.time.total / 3600);

        this.elevation.gain += other.elevation.gain;
        this.elevation.loss += other.elevation.loss;

        this.bounds.southWest.lat = Math.min(this.bounds.southWest.lat, other.bounds.southWest.lat);
        this.bounds.southWest.lon = Math.max(this.bounds.southWest.lon, other.bounds.southWest.lon);
        this.bounds.northEast.lat = Math.max(this.bounds.northEast.lat, other.bounds.northEast.lat);
        this.bounds.northEast.lon = Math.min(this.bounds.northEast.lon, other.bounds.northEast.lon);
    }
}

export type TrackPointStatistics = {
    distance: number[],
    time: number[],
    speed: number[],
    elevation: {
        smoothed: number[],
        gain: number[],
        loss: number[],
    },
    slope: number[],
}

const earthRadius = 6371008.8;
function distance(coord1: Coordinates, coord2: Coordinates): number {
    const rad = Math.PI / 180;
    const lat1 = coord1.lat * rad;
    const lat2 = coord2.lat * rad;
    const a = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((coord2.lon - coord1.lon) * rad);
    const maxMeters = earthRadius * Math.acos(Math.min(a, 1));
    return maxMeters;
}

function distanceWindowSmoothing(points: TrackPoint[], distanceWindow: number, accumulate: (index: number) => number, compute: (accumulated: number, start: number, end: number) => number, remove?: (index: number) => number): number[] {
    let result = [];

    let start = 0, end = 0, accumulated = 0;
    for (var i = 0; i < points.length; i++) {
        while (start < i && distance(points[start].getCoordinates(), points[i].getCoordinates()) > distanceWindow) {
            if (remove) {
                accumulated -= remove(start);
            } else {
                accumulated -= accumulate(start);
            }
            start++;
        }
        while (end < points.length && distance(points[i].getCoordinates(), points[end].getCoordinates()) <= distanceWindow) {
            accumulated += accumulate(end);
            end++;
        }
        result[i] = compute(accumulated, start, end - 1);
    }

    return result;
}

function distanceWindowSmoothingWithDistanceAccumulator(points: TrackPoint[], distanceWindow: number, compute: (accumulated: number, start: number, end: number) => number): number[] {
    return distanceWindowSmoothing(points, distanceWindow, (index) => index > 0 ? distance(points[index - 1].getCoordinates(), points[index].getCoordinates()) : 0, compute, (index) => distance(points[index].getCoordinates(), points[index + 1].getCoordinates()));
}