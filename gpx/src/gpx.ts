import { Coordinates, GPXFileAttributes, GPXFileType, Link, Metadata, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, WaypointType } from "./types";

function cloneJSON<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
}

// An abstract class that groups functions that need to be computed recursively in the GPX file hierarchy
abstract class GPXTreeElement<T extends GPXTreeElement<any>> {

    abstract isLeaf(): boolean;
    abstract getChildren(): T[];

    abstract computeStatistics(): GPXStatistics;

    abstract reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void;

    abstract getStartTimestamp(): Date;
    abstract getEndTimestamp(): Date;
    abstract getTrackPointsAndStatistics(): { points: TrackPoint[], statistics: TrackPointStatistics };

    abstract toGeoJSON(): any;
}

// An abstract class that can be extended to facilitate functions working similarly with Tracks and TrackSegments
abstract class GPXTreeNode<T extends GPXTreeElement<any>> extends GPXTreeElement<T> {
    statistics: GPXStatistics;

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

        for (let child of this.getChildren()) {
            let childData = child.getTrackPointsAndStatistics();
            points = points.concat(childData.points);
            statistics.distance = statistics.distance.concat(childData.statistics.distance);
            statistics.time = statistics.time.concat(childData.statistics.time);
            statistics.speed = statistics.speed.concat(childData.statistics.speed);
            statistics.elevation.smoothed = statistics.elevation.smoothed.concat(childData.statistics.elevation.smoothed);
            statistics.elevation.gain = statistics.elevation.gain.concat(childData.statistics.elevation.gain);
            statistics.elevation.loss = statistics.elevation.loss.concat(childData.statistics.elevation.loss);
            statistics.slope = statistics.slope.concat(childData.statistics.slope);
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

            trkptStatistics.speed.push(speed);
        }

        statistics.time.total = trkptStatistics.time[trkptStatistics.time.length - 1];
        statistics.speed.total = statistics.distance.total / (statistics.time.total / 3600);
        statistics.speed.moving = statistics.distance.moving / (statistics.time.moving / 3600);

        this.trkptStatistics = trkptStatistics;

        return statistics;
    }

    computeSmoothedElevation(): number[] {
        const ELEVATION_SMOOTHING_DISTANCE_THRESHOLD = 100;

        let smoothed = [];

        const points = this.trkpt;

        let start = 0, end = -1, cumul = 0;
        for (var i = 0; i < points.length; i++) {
            while (start < i && distance(points[start].getCoordinates(), points[i].getCoordinates()) > ELEVATION_SMOOTHING_DISTANCE_THRESHOLD) {
                cumul -= points[start].ele;
                start++;
            }
            while (end + 1 < points.length && distance(points[i].getCoordinates(), points[end + 1].getCoordinates()) <= ELEVATION_SMOOTHING_DISTANCE_THRESHOLD) {
                cumul += points[end + 1].ele;
                end++;
            }

            smoothed.push(cumul / (end - start + 1));
        }

        if (points.length > 0) {
            smoothed[0] = points[0].ele;
            smoothed[points.length - 1] = points[points.length - 1].ele;
        }

        return smoothed;
    }

    computeSlope(): number[] {
        let slope = [];

        const SLOPE_DISTANCE_THRESHOLD = 100;

        const points = this.trkpt;

        let start = 0, end = 0, windowDistance = 0;
        for (var i = 0; i < points.length; i++) {
            while (start < i && distance(points[start].getCoordinates(), points[i].getCoordinates()) > SLOPE_DISTANCE_THRESHOLD) {
                windowDistance -= distance(points[start].getCoordinates(), points[start + 1].getCoordinates());
                start++;
            }
            while (end + 1 < points.length && distance(points[i].getCoordinates(), points[end + 1].getCoordinates()) <= SLOPE_DISTANCE_THRESHOLD) {
                windowDistance += distance(points[end].getCoordinates(), points[end + 1].getCoordinates());
                end++;
            }
            slope[i] = windowDistance > 1e-3 ? 100 * (points[end].ele - points[start].ele) / windowDistance : 0;
        }

        return slope;
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