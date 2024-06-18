import { Coordinates, GPXFileAttributes, GPXFileType, Link, Metadata, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, WaypointType } from "./types";
import { Draft, immerable, isDraft, original, produce, freeze } from "immer";

function cloneJSON<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
}

// An abstract class that groups functions that need to be computed recursively in the GPX file hierarchy
export abstract class GPXTreeElement<T extends GPXTreeElement<any>> {
    _data: { [key: string]: any } = {};

    abstract isLeaf(): boolean;
    abstract get children(): ReadonlyArray<T>;

    abstract getNumberOfTrackPoints(): number;
    abstract getStartTimestamp(): Date;
    abstract getEndTimestamp(): Date;
    abstract getStatistics(): GPXStatistics;
    abstract getSegments(): TrackSegment[];

    abstract toGeoJSON(): GeoJSON.Feature | GeoJSON.Feature[] | GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];

    // Producers
    abstract _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date);
}

export type AnyGPXTreeElement = GPXTreeElement<GPXTreeElement<any>>;

// An abstract class that can be extended to facilitate functions working similarly with Tracks and TrackSegments
abstract class GPXTreeNode<T extends GPXTreeElement<any>> extends GPXTreeElement<T> {
    isLeaf(): boolean {
        return false;
    }

    getNumberOfTrackPoints(): number {
        return this.children.reduce((acc, child) => acc + child.getNumberOfTrackPoints(), 0);
    }

    getStartTimestamp(): Date {
        return this.children[0].getStartTimestamp();
    }

    getEndTimestamp(): Date {
        return this.children[this.children.length - 1].getEndTimestamp();
    }

    getStatistics(): GPXStatistics {
        let statistics = new GPXStatistics();
        for (let child of this.children) {
            statistics.mergeWith(child.getStatistics());
        }
        return statistics;
    }

    getSegments(): TrackSegment[] {
        return this.children.flatMap((child) => child.getSegments());
    }

    // Producers
    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date) {
        return produce(this, (draft: Draft<GPXTreeNode<T>>) => {
            let og = getOriginal(draft);
            if (!originalNextTimestamp && !newPreviousTimestamp) {
                originalNextTimestamp = og.children[og.children.length - 1].getEndTimestamp();
                newPreviousTimestamp = og.children[0].getStartTimestamp();
            }

            draft.children.reverse();

            for (let i = 0; i < og.children.length; i++) {
                let originalStartTimestamp = og.children[og.children.length - i - 1].getStartTimestamp();

                draft.children[i] = draft.children[i]._reverse(originalNextTimestamp, newPreviousTimestamp);

                originalNextTimestamp = originalStartTimestamp;
                newPreviousTimestamp = draft.children[i].getEndTimestamp();
            }
        });
    }
}

// An abstract class that TrackSegment extends to implement the GPXTreeElement interface
abstract class GPXTreeLeaf extends GPXTreeElement<GPXTreeLeaf> {
    isLeaf(): boolean {
        return true;
    }

    get children(): ReadonlyArray<GPXTreeLeaf> {
        return [];
    }
}

// A class that represents a set of GPX files
export class GPXFiles extends GPXTreeNode<GPXFile> {
    readonly files: ReadonlyArray<GPXFile>;

    constructor(files: GPXFile[]) {
        super();
        this.files = files;
    }

    get children(): ReadonlyArray<GPXFile> {
        return this.files;
    }

    toGeoJSON(): GeoJSON.FeatureCollection[] {
        return this.children.map((child) => child.toGeoJSON());
    }
}

// A class that represents a GPX file
export class GPXFile extends GPXTreeNode<Track>{
    [immerable] = true;

    attributes: GPXFileAttributes;
    metadata: Metadata;
    readonly wpt: ReadonlyArray<Readonly<Waypoint>>;
    readonly trk: ReadonlyArray<Track>;

    constructor(gpx?: GPXFileType & { _data?: any } | GPXFile) {
        super();
        if (gpx) {
            this.attributes = gpx.attributes
            this.metadata = gpx.metadata;
            this.wpt = gpx.wpt ? gpx.wpt.map((waypoint, index) => new Waypoint(waypoint, index)) : [];
            this.trk = gpx.trk ? gpx.trk.map((track) => new Track(track)) : [];
            if (gpx.hasOwnProperty('_data')) {
                this._data = gpx._data;
            }
        } else {
            this.attributes = {};
            this.metadata = {};
            this.wpt = [];
            this.trk = [new Track()];
        }
    }

    get children(): ReadonlyArray<Track> {
        return this.trk;
    }

    getSegment(trackIndex: number, segmentIndex: number): TrackSegment {
        return this.trk[trackIndex].children[segmentIndex];
    }

    forEachSegment(callback: (segment: TrackSegment, trackIndex: number, segmentIndex: number) => void) {
        this.trk.forEach((track, trackIndex) => {
            track.children.forEach((segment, segmentIndex) => {
                callback(segment, trackIndex, segmentIndex);
            });
        });
    }

    clone(): GPXFile {
        return new GPXFile({
            attributes: cloneJSON(this.attributes),
            metadata: cloneJSON(this.metadata),
            wpt: this.wpt.map((waypoint) => waypoint.clone()),
            trk: this.trk.map((track) => track.clone()),
            _data: cloneJSON(this._data),
        });
    }

    toGeoJSON(): GeoJSON.FeatureCollection {
        return {
            type: "FeatureCollection",
            features: this.children.flatMap((child) => child.toGeoJSON())
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

    // Producers
    replaceTracks(start: number, end: number, tracks: Track[]): [GPXFile, Track[]] {
        let removed = [];
        let result = produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            removed = trk.splice(start, end - start + 1, ...tracks);
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
        return [result, removed];
    }

    replaceTrackSegments(trackIndex: number, start: number, end: number, segments: TrackSegment[]): [GPXFile, TrackSegment[]] {
        let removed = [];
        let result = produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            let [result, rmv] = trk[trackIndex].replaceTrackSegments(start, end, segments);
            trk[trackIndex] = result;
            removed = rmv;
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
        return [result, removed];
    }

    replaceTrackPoints(trackIndex: number, segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            trk[trackIndex] = trk[trackIndex].replaceTrackPoints(segmentIndex, start, end, points, speed, startTime);
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
    }

    replaceWaypoints(start: number, end: number, waypoints: Waypoint[]): [GPXFile, Waypoint[]] {
        let removed = [];
        let result = produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let wpt = og.wpt.slice();
            removed = wpt.splice(start, end - start + 1, ...waypoints);
            draft.wpt = freeze(wpt); // Pre-freeze the array, faster as well
        });
        return [result, removed];
    }

    reverse() {
        return this._reverse(this.getEndTimestamp(), this.getStartTimestamp());
    }

    reverseTrack(trackIndex: number) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            trk[trackIndex] = trk[trackIndex]._reverse();
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
    }

    reverseTrackSegment(trackIndex: number, segmentIndex: number) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            trk[trackIndex] = trk[trackIndex].reverseTrackSegment(segmentIndex);
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
    }

    crop(start: number, end: number, trackIndices?: number[], segmentIndices?: number[]) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.slice();
            let i = 0;
            let trackIndex = 0;
            while (i < trk.length) {
                let length = trk[i].getNumberOfTrackPoints();
                if (trackIndices === undefined || trackIndices.includes(trackIndex)) {
                    if (start >= length || end < 0) {
                        trk.splice(i, 1);
                    } else {
                        if (start > 0 || end < length - 1) {
                            trk[i] = trk[i].crop(Math.max(0, start), Math.min(length - 1, end), segmentIndices);
                        }
                        i++;
                    }
                    start -= length;
                    end -= length;
                } else {
                    i++;
                }
                trackIndex++;
            }
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean, deleteTrackPoints: boolean, deleteWaypoints: boolean, trackIndices?: number[], segmentIndices?: number[], waypointIndices?: number[]) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            if (deleteTrackPoints) {
                let trk = og.trk.slice();
                let i = 0;
                let trackIndex = 0;
                while (i < trk.length) {
                    if (trackIndices === undefined || trackIndices.includes(trackIndex)) {
                        trk[i] = trk[i].clean(bounds, inside, segmentIndices);
                        if (trk[i].getNumberOfTrackPoints() === 0) {
                            trk.splice(i, 1);
                        } else {
                            i++;
                        }
                    } else {
                        i++;
                    }
                    trackIndex++;
                }
                draft.trk = freeze(trk); // Pre-freeze the array, faster as well
            }
            if (deleteWaypoints) {
                let wpt = og.wpt.filter((point, waypointIndex) => {
                    if (waypointIndices === undefined || waypointIndices.includes(waypointIndex)) {
                        let inBounds = point.attributes.lat >= bounds[0].lat && point.attributes.lat <= bounds[1].lat && point.attributes.lon >= bounds[0].lon && point.attributes.lon <= bounds[1].lon;
                        return inBounds !== inside;
                    } else {
                        return true;
                    }
                });
                draft.wpt = freeze(wpt); // Pre-freeze the array, faster as well
            }
        });
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, trackIndex?: number, segmentIndex?: number) {
        let lastPoint = undefined;
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trk = og.trk.map((track, index) => {
                if (trackIndex === undefined || trackIndex === index) {
                    return track.changeTimestamps(startTime, speed, ratio, lastPoint, segmentIndex);
                } else {
                    return track;
                }
            });
            draft.trk = freeze(trk); // Pre-freeze the array, faster as well
        });
    }
};

// A class that represents a Track in a GPX file
export class Track extends GPXTreeNode<TrackSegment> {
    [immerable] = true;

    readonly name?: string;
    readonly cmt?: string;
    readonly desc?: string;
    readonly src?: string;
    readonly link?: Link;
    readonly type?: string;
    readonly trkseg: ReadonlyArray<TrackSegment>;
    readonly extensions?: TrackExtensions;

    constructor(track?: TrackType & { _data?: any } | Track) {
        super();
        if (track) {
            this.name = track.name;
            this.cmt = track.cmt;
            this.desc = track.desc;
            this.src = track.src;
            this.link = track.link;
            this.type = track.type;
            this.trkseg = track.trkseg ? track.trkseg.map((seg) => new TrackSegment(seg)) : [];
            this.extensions = track.extensions;
            if (track.hasOwnProperty('_data')) {
                this._data = track._data;
            }
        } else {
            this.trkseg = [new TrackSegment()];
        }
    }

    get children(): ReadonlyArray<TrackSegment> {
        return this.trkseg;
    }

    clone(): Track {
        return new Track({
            name: this.name,
            cmt: this.cmt,
            desc: this.desc,
            src: this.src,
            link: cloneJSON(this.link),
            type: this.type,
            trkseg: this.trkseg.map((seg) => seg.clone()),
            extensions: cloneJSON(this.extensions),
            _data: cloneJSON(this._data),
        });
    }

    toGeoJSON(): GeoJSON.Feature[] {
        return this.children.map((child) => {
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

    // Producers
    replaceTrackSegments(start: number, end: number, segments: TrackSegment[]): [Track, TrackSegment[]] {
        let removed = [];
        let result = produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            removed = trkseg.splice(start, end - start + 1, ...segments);
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
        return [result, removed];
    }

    replaceTrackPoints(segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            trkseg[segmentIndex] = trkseg[segmentIndex].replaceTrackPoints(start, end, points, speed, startTime);
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
    }

    reverseTrackSegment(segmentIndex: number) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            trkseg[segmentIndex] = trkseg[segmentIndex]._reverse(trkseg[segmentIndex].getEndTimestamp(), trkseg[segmentIndex].getStartTimestamp());
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
    }

    crop(start: number, end: number, segmentIndices?: number[]) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            let i = 0;
            let segmentIndex = 0;
            while (i < trkseg.length) {
                let length = trkseg[i].getNumberOfTrackPoints();
                if (segmentIndices === undefined || segmentIndices.includes(segmentIndex)) {
                    if (start >= length || end < 0) {
                        trkseg.splice(i, 1);
                    } else {
                        if (start > 0 || end < length - 1) {
                            trkseg[i] = trkseg[i].crop(Math.max(0, start), Math.min(length - 1, end));
                        }
                        i++;
                    }
                    start -= length;
                    end -= length;
                } else {
                    i++;
                }
                segmentIndex++;
            }
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean, segmentIndices?: number[]) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            let i = 0;
            let segmentIndex = 0;
            while (i < trkseg.length) {
                if (segmentIndices === undefined || segmentIndices.includes(segmentIndex)) {
                    trkseg[i] = trkseg[i].clean(bounds, inside);
                    if (trkseg[i].getNumberOfTrackPoints() === 0) {
                        trkseg.splice(i, 1);
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }
                segmentIndex++;
            }
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint, segmentIndex?: number) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkseg = og.trkseg.slice();
            trkseg = trkseg.map((segment, index) => {
                if (segmentIndex === undefined || segmentIndex === index) {
                    let seg = segment.changeTimestamps(startTime, speed, ratio, lastPoint);
                    if (seg.trkpt.length > 0) {
                        lastPoint = seg.trkpt[seg.trkpt.length - 1];
                    }
                    return seg;
                } else {
                    return segment;
                }
            });
            draft.trkseg = freeze(trkseg); // Pre-freeze the array, faster as well
        });
    }
};

// A class that represents a TrackSegment in a GPX file
export class TrackSegment extends GPXTreeLeaf {
    [immerable] = true;

    readonly trkpt: ReadonlyArray<Readonly<TrackPoint>>;

    constructor(segment?: TrackSegmentType & { _data?: any } | TrackSegment) {
        super();
        if (segment) {
            this.trkpt = segment.trkpt.map((point) => new TrackPoint(point));
            if (segment.hasOwnProperty('_data')) {
                this._data = segment._data;
            }
        } else {
            this.trkpt = [];
        }
    }

    _computeStatistics(): GPXStatistics {
        let statistics = new GPXStatistics();

        statistics.local.points = this.trkpt.map((point) => point);

        statistics.local.elevation.smoothed = this._computeSmoothedElevation();
        statistics.local.slope = this._computeSlope();

        const points = this.trkpt;
        for (let i = 0; i < points.length; i++) {
            points[i]._data['index'] = i;

            // distance
            let dist = 0;
            if (i > 0) {
                dist = distance(points[i - 1].getCoordinates(), points[i].getCoordinates()) / 1000;

                statistics.global.distance.total += dist;
            }

            statistics.local.distance.total.push(statistics.global.distance.total);

            // elevation
            if (i > 0) {
                const ele = statistics.local.elevation.smoothed[i] - statistics.local.elevation.smoothed[i - 1];
                if (ele > 0) {
                    statistics.global.elevation.gain += ele;
                } else if (ele < 0) {
                    statistics.global.elevation.loss -= ele;
                }
            }

            statistics.local.elevation.gain.push(statistics.global.elevation.gain);
            statistics.local.elevation.loss.push(statistics.global.elevation.loss);

            // time
            if (points[i].time === undefined) {
                statistics.local.time.total.push(undefined);
            } else {
                if (statistics.global.time.start === undefined) {
                    statistics.global.time.start = points[i].time;
                }
                statistics.global.time.end = points[i].time;
                statistics.local.time.total.push((points[i].time.getTime() - statistics.global.time.start.getTime()) / 1000);
            }

            // speed
            let speed = 0;
            if (i > 0 && points[i - 1].time !== undefined && points[i].time !== undefined) {
                const time = (points[i].time.getTime() - points[i - 1].time.getTime()) / 1000;
                speed = dist / (time / 3600);

                if (speed >= 0.5) {
                    statistics.global.distance.moving += dist;
                    statistics.global.time.moving += time;
                }
            }

            statistics.local.distance.moving.push(statistics.global.distance.moving);
            statistics.local.time.moving.push(statistics.global.time.moving);

            // bounds
            statistics.global.bounds.southWest.lat = Math.min(statistics.global.bounds.southWest.lat, points[i].attributes.lat);
            statistics.global.bounds.southWest.lon = Math.min(statistics.global.bounds.southWest.lon, points[i].attributes.lon);
            statistics.global.bounds.northEast.lat = Math.max(statistics.global.bounds.northEast.lat, points[i].attributes.lat);
            statistics.global.bounds.northEast.lon = Math.max(statistics.global.bounds.northEast.lon, points[i].attributes.lon);
        }

        statistics.global.time.total = statistics.global.time.start && statistics.global.time.end ? (statistics.global.time.end.getTime() - statistics.global.time.start.getTime()) / 1000 : 0;
        statistics.global.speed.total = statistics.global.time.total > 0 ? statistics.global.distance.total / (statistics.global.time.total / 3600) : 0;
        statistics.global.speed.moving = statistics.global.time.moving > 0 ? statistics.global.distance.moving / (statistics.global.time.moving / 3600) : 0;

        statistics.local.speed = distanceWindowSmoothingWithDistanceAccumulator(points, 200, (accumulated, start, end) => (points[start].time && points[end].time) ? 3600 * accumulated / (points[end].time.getTime() - points[start].time.getTime()) : undefined);

        return statistics;
    }

    _computeSmoothedElevation(): number[] {
        const points = this.trkpt;

        let smoothed = distanceWindowSmoothing(points, 100, (index) => points[index].ele, (accumulated, start, end) => accumulated / (end - start + 1));

        if (points.length > 0) {
            smoothed[0] = points[0].ele;
            smoothed[points.length - 1] = points[points.length - 1].ele;
        }

        return smoothed;
    }

    _computeSlope(): number[] {
        const points = this.trkpt;

        return distanceWindowSmoothingWithDistanceAccumulator(points, 50, (accumulated, start, end) => 100 * (points[end].ele - points[start].ele) / accumulated);
    }

    getNumberOfTrackPoints(): number {
        return this.trkpt.length;
    }

    getStartTimestamp(): Date {
        return this.trkpt[0].time;
    }

    getEndTimestamp(): Date {
        return this.trkpt[this.trkpt.length - 1].time;
    }

    getStatistics(): GPXStatistics {
        return this._computeStatistics();
    }

    getSegments(): TrackSegment[] {
        return [this];
    }

    toGeoJSON(): GeoJSON.Feature {
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
            trkpt: this.trkpt.map((point) => point.toTrackPointType())
        };
    }

    clone(): TrackSegment {
        return new TrackSegment({
            trkpt: this.trkpt.map((point) => point.clone()),
            _data: cloneJSON(this._data),
        });
    }

    // Producers
    replaceTrackPoints(start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkpt = og.trkpt.slice();

            if (speed !== undefined || (trkpt.length > 0 && trkpt[0].time !== undefined)) {
                if (start > 0 && trkpt[0].time === undefined) {
                    trkpt.splice(0, 0, withTimestamps(trkpt.splice(0, start), speed, undefined, startTime));
                }
                if (points.length > 0) {
                    let last = start > 0 ? trkpt[start - 1] : undefined;
                    if (points[0].time === undefined || (points.length > 1 && points[1].time === undefined)) {
                        points = withTimestamps(points, speed, last, startTime);
                    } else if (last !== undefined && points[0].time < last.time) {
                        points = withShiftedAndCompressedTimestamps(points, speed, 1, last);
                    }
                }
                if (end < trkpt.length - 1) {
                    let last = points.length > 0 ? points[points.length - 1] : start > 0 ? trkpt[start - 1] : undefined;
                    if (trkpt[end + 1].time === undefined) {
                        trkpt.splice(end + 1, 0, withTimestamps(trkpt.splice(end + 1), speed, last, startTime));
                    } else if (last !== undefined && trkpt[end + 1].time < last.time) {
                        points = withShiftedAndCompressedTimestamps(points, speed, 1, last);
                    }
                }
            }

            trkpt.splice(start, end - start + 1, ...points);
            draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        });
    }

    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date) {
        return produce(this, (draft) => {
            if (originalNextTimestamp !== undefined && newPreviousTimestamp !== undefined) {
                let og = getOriginal(draft); // Read as much as possible from the original object because it is faster

                let originalEndTimestamp = og.getEndTimestamp();
                let newStartTimestamp = new Date(
                    newPreviousTimestamp.getTime() + originalNextTimestamp.getTime() - originalEndTimestamp.getTime()
                );

                let trkpt = og.trkpt.map((point, i) => new TrackPoint({
                    attributes: cloneJSON(point.attributes),
                    ele: point.ele,
                    time: new Date(
                        newStartTimestamp.getTime() + (originalEndTimestamp.getTime() - og.trkpt[i].time.getTime())
                    ),
                    extensions: cloneJSON(point.extensions),
                    _data: cloneJSON(point._data),
                }));

                trkpt.reverse();

                draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
            } else {
                draft.trkpt.reverse();
            }
        });
    }

    crop(start: number, end: number) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkpt = og.trkpt.slice(start, end + 1);
            draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        });
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean) {
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            let trkpt = og.trkpt.filter((point) => {
                let inBounds = point.attributes.lat >= bounds[0].lat && point.attributes.lat <= bounds[1].lat && point.attributes.lon >= bounds[0].lon && point.attributes.lon <= bounds[1].lon;
                return inBounds !== inside;
            });
            draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        });
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint) {
        if (lastPoint === undefined && this.trkpt.length > 0) {
            lastPoint = this.trkpt[0].clone();
            lastPoint.time = startTime;
        }
        return produce(this, (draft) => {
            let og = getOriginal(draft); // Read as much as possible from the original object because it is faster
            if (og.trkpt.length > 0 && og.trkpt[0].time === undefined) {
                let trkpt = withTimestamps(og.trkpt, speed, lastPoint, startTime);
                draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
            } else {
                let trkpt = withShiftedAndCompressedTimestamps(og.trkpt, speed, ratio, lastPoint);
                draft.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
            }
        });
    }
};

export class TrackPoint {
    [immerable] = true;

    attributes: Coordinates;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;
    _data: { [key: string]: any } = {};

    constructor(point: TrackPointType & { _data?: any } | TrackPoint) {
        this.attributes = point.attributes;
        this.ele = point.ele;
        this.time = point.time;
        this.extensions = point.extensions;
        if (point.hasOwnProperty('_data')) {
            this._data = point._data;
        }
    }

    getCoordinates(): Coordinates {
        return this.attributes;
    }

    setCoordinates(coordinates: Coordinates): void {
        this.attributes = coordinates;
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

    setSurface(surface: string): void {
        if (!this.extensions) {
            this.extensions = {};
        }
        if (!this.extensions["gpxtpx:TrackPointExtension"]) {
            this.extensions["gpxtpx:TrackPointExtension"] = {};
        }
        if (!this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]) {
            this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] = {};
        }
        this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]["surface"] = surface;
    }

    toTrackPointType(): TrackPointType {
        return {
            attributes: this.attributes,
            ele: this.ele,
            time: this.time,
            extensions: this.extensions,
        };
    }

    clone(): TrackPoint {
        return new TrackPoint({
            attributes: cloneJSON(this.attributes),
            ele: this.ele,
            time: this.time ? new Date(this.time.getTime()) : undefined,
            extensions: cloneJSON(this.extensions),
            _data: cloneJSON(this._data),
        });
    }
};

export class Waypoint {
    [immerable] = true;

    attributes: Coordinates;
    ele?: number;
    time?: Date;
    name?: string;
    cmt?: string;
    desc?: string;
    link?: Link;
    sym?: string;
    type?: string;
    _data: { [key: string]: any } = {};

    constructor(waypoint: WaypointType & { _data?: any } | Waypoint, index?: number) {
        this.attributes = waypoint.attributes;
        this.ele = waypoint.ele;
        this.time = waypoint.time;
        this.name = waypoint.name;
        this.cmt = waypoint.cmt;
        this.desc = waypoint.desc;
        this.link = waypoint.link;
        this.sym = waypoint.sym;
        this.type = waypoint.type;
        if (waypoint.hasOwnProperty('_data')) {
            this._data = waypoint._data;
        }
        if (index !== undefined) {
            this._data['index'] = index;
        }
    }

    getCoordinates(): Coordinates {
        return this.attributes;
    }

    setCoordinates(coordinates: Coordinates): void {
        this.attributes = coordinates;
    }

    getLatitude(): number {
        return this.attributes.lat;
    }

    getLongitude(): number {
        return this.attributes.lon;
    }

    clone(): Waypoint {
        return new Waypoint({
            attributes: cloneJSON(this.attributes),
            ele: this.ele,
            time: this.time ? new Date(this.time.getTime()) : undefined,
            name: this.name,
            cmt: this.cmt,
            desc: this.desc,
            link: cloneJSON(this.link),
            sym: this.sym,
            type: this.type,
        });
    }
}

export class GPXStatistics {
    global: {
        distance: {
            moving: number,
            total: number,
        },
        time: {
            start: Date | undefined,
            end: Date | undefined,
            moving: number,
            total: number,
        },
        speed: {
            moving: number,
            total: number,
        },
        elevation: {
            gain: number,
            loss: number,
        },
        bounds: {
            southWest: Coordinates,
            northEast: Coordinates,
        },
    };
    local: {
        points: TrackPoint[],
        distance: {
            moving: number[],
            total: number[],
        },
        time: {
            moving: number[],
            total: number[],
        },
        speed: number[],
        elevation: {
            smoothed: number[],
            gain: number[],
            loss: number[],
        },
        slope: number[],
    };

    constructor() {
        this.global = {
            distance: {
                moving: 0,
                total: 0,
            },
            time: {
                start: undefined,
                end: undefined,
                moving: 0,
                total: 0,
            },
            speed: {
                moving: 0,
                total: 0,
            },
            elevation: {
                gain: 0,
                loss: 0,
            },
            bounds: {
                southWest: {
                    lat: 90,
                    lon: 180,
                },
                northEast: {
                    lat: -90,
                    lon: -180,
                },
            },
        };
        this.local = {
            points: [],
            distance: {
                moving: [],
                total: [],
            },
            time: {
                moving: [],
                total: [],
            },
            speed: [],
            elevation: {
                smoothed: [],
                gain: [],
                loss: [],
            },
            slope: [],
        };
    }

    mergeWith(other: GPXStatistics): void {
        this.local.points = this.local.points.concat(other.local.points);

        this.local.distance.total = this.local.distance.total.concat(other.local.distance.total.map((distance) => distance + this.global.distance.total));
        this.local.distance.moving = this.local.distance.moving.concat(other.local.distance.moving.map((distance) => distance + this.global.distance.moving));
        this.local.time.total = this.local.time.total.concat(other.local.time.total.map((time) => time + this.global.time.total));
        this.local.time.moving = this.local.time.moving.concat(other.local.time.moving.map((time) => time + this.global.time.moving));
        this.local.elevation.gain = this.local.elevation.gain.concat(other.local.elevation.gain.map((gain) => gain + this.global.elevation.gain));
        this.local.elevation.loss = this.local.elevation.loss.concat(other.local.elevation.loss.map((loss) => loss + this.global.elevation.loss));

        this.local.speed = this.local.speed.concat(other.local.speed);
        this.local.elevation.smoothed = this.local.elevation.smoothed.concat(other.local.elevation.smoothed);
        this.local.slope = this.local.slope.concat(other.local.slope);

        this.global.distance.total += other.global.distance.total;
        this.global.distance.moving += other.global.distance.moving;

        this.global.time.start = this.global.time.start !== undefined && other.global.time.start !== undefined ? new Date(Math.min(this.global.time.start.getTime(), other.global.time.start.getTime())) : this.global.time.start ?? other.global.time.start;
        this.global.time.end = this.global.time.end !== undefined && other.global.time.end !== undefined ? new Date(Math.max(this.global.time.end.getTime(), other.global.time.end.getTime())) : this.global.time.end ?? other.global.time.end;

        this.global.time.total += other.global.time.total;
        this.global.time.moving += other.global.time.moving;

        this.global.speed.moving = this.global.time.moving > 0 ? this.global.distance.moving / (this.global.time.moving / 3600) : 0;
        this.global.speed.total = this.global.time.total > 0 ? this.global.distance.total / (this.global.time.total / 3600) : 0;

        this.global.elevation.gain += other.global.elevation.gain;
        this.global.elevation.loss += other.global.elevation.loss;

        this.global.bounds.southWest.lat = Math.min(this.global.bounds.southWest.lat, other.global.bounds.southWest.lat);
        this.global.bounds.southWest.lon = Math.min(this.global.bounds.southWest.lon, other.global.bounds.southWest.lon);
        this.global.bounds.northEast.lat = Math.max(this.global.bounds.northEast.lat, other.global.bounds.northEast.lat);
        this.global.bounds.northEast.lon = Math.max(this.global.bounds.northEast.lon, other.global.bounds.northEast.lon);
    }

    slice(start: number, end: number): GPXStatistics {
        let statistics = new GPXStatistics();

        statistics.local.points = this.local.points.slice(start, end + 1);

        statistics.global.distance.total = this.local.distance.total[end] - this.local.distance.total[start];
        statistics.global.distance.moving = this.local.distance.moving[end] - this.local.distance.moving[start];

        statistics.global.time.start = this.local.points[start].time;
        statistics.global.time.end = this.local.points[end].time;

        statistics.global.time.total = this.local.time.total[end] - this.local.time.total[start];
        statistics.global.time.moving = this.local.time.moving[end] - this.local.time.moving[start];

        statistics.global.speed.moving = statistics.global.time.moving > 0 ? statistics.global.distance.moving / (statistics.global.time.moving / 3600) : 0;
        statistics.global.speed.total = statistics.global.time.total > 0 ? statistics.global.distance.total / (statistics.global.time.total / 3600) : 0;

        statistics.global.elevation.gain = this.local.elevation.gain[end] - this.local.elevation.gain[start];
        statistics.global.elevation.loss = this.local.elevation.loss[end] - this.local.elevation.loss[start];

        statistics.global.bounds.southWest.lat = this.global.bounds.southWest.lat;
        statistics.global.bounds.southWest.lon = this.global.bounds.southWest.lon;
        statistics.global.bounds.northEast.lat = this.global.bounds.northEast.lat;
        statistics.global.bounds.northEast.lon = this.global.bounds.northEast.lon;

        return statistics;
    }
}

const earthRadius = 6371008.8;
export function distance(coord1: Coordinates, coord2: Coordinates): number {
    const rad = Math.PI / 180;
    const lat1 = coord1.lat * rad;
    const lat2 = coord2.lat * rad;
    const a = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((coord2.lon - coord1.lon) * rad);
    const maxMeters = earthRadius * Math.acos(Math.min(a, 1));
    return maxMeters;
}

function distanceWindowSmoothing(points: ReadonlyArray<Readonly<TrackPoint>>, distanceWindow: number, accumulate: (index: number) => number, compute: (accumulated: number, start: number, end: number) => number, remove?: (index: number) => number): number[] {
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

function distanceWindowSmoothingWithDistanceAccumulator(points: ReadonlyArray<Readonly<TrackPoint>>, distanceWindow: number, compute: (accumulated: number, start: number, end: number) => number): number[] {
    return distanceWindowSmoothing(points, distanceWindow, (index) => index > 0 ? distance(points[index - 1].getCoordinates(), points[index].getCoordinates()) : 0, compute, (index) => distance(points[index].getCoordinates(), points[index + 1].getCoordinates()));
}

function withTimestamps(points: TrackPoint[], speed: number, lastPoint: TrackPoint | undefined, startTime?: Date): TrackPoint[] {
    let last = lastPoint;
    if (last === undefined) {
        last = points[0].clone();
        last.time = startTime;
    }
    return points.map((point) => {
        let time = getTimestamp(last, point, speed);
        last = point.clone();
        last.time = time;
        return last;
    });
}

function withShiftedAndCompressedTimestamps(points: TrackPoint[], speed: number, ratio: number, lastPoint: TrackPoint): TrackPoint[] {
    let start = getTimestamp(lastPoint, points[0], speed);
    return points.map((point) => {
        let pt = point.clone();
        pt.time = new Date(start.getTime() + ratio * (point.time.getTime() - points[0].time.getTime()));
        return pt;
    });
}

function getTimestamp(a: TrackPoint, b: TrackPoint, speed: number): Date {
    let dist = distance(a.getCoordinates(), b.getCoordinates()) / 1000;
    return new Date(a.time.getTime() + 1000 * 3600 * dist / speed);
}

function getOriginal(obj: any): any {
    while (isDraft(obj)) {
        obj = original(obj);
    }
    return obj;
}