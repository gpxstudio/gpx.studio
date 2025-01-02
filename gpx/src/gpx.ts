import { ramerDouglasPeucker } from "./simplify";
import { Coordinates, GPXFileAttributes, GPXFileType, LineStyleExtension, Link, Metadata, RouteType, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, WaypointType } from "./types";
import { immerable, isDraft, original, freeze } from "immer";

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
    abstract get children(): Array<T>;

    abstract getNumberOfTrackPoints(): number;
    abstract getStartTimestamp(): Date | undefined;
    abstract getEndTimestamp(): Date | undefined;
    abstract getStatistics(): GPXStatistics;
    abstract getSegments(): TrackSegment[];
    abstract getTrackPoints(): TrackPoint[];

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

    getStartTimestamp(): Date | undefined {
        if (this.children.length === 0) {
            return undefined;
        }
        return this.children[0].getStartTimestamp();
    }

    getEndTimestamp(): Date | undefined {
        if (this.children.length === 0) {
            return undefined;
        }
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

    getTrackPoints(): TrackPoint[] {
        return this.children.flatMap((child) => child.getTrackPoints());
    }

    // Producers
    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date) {
        let og = getOriginal(this);
        if (!originalNextTimestamp && !newPreviousTimestamp) {
            originalNextTimestamp = og.getEndTimestamp();
            newPreviousTimestamp = og.getStartTimestamp();
        }

        this.children.reverse();

        for (let i = 0; i < og.children.length; i++) {
            let originalStartTimestamp = og.children[og.children.length - i - 1].getStartTimestamp();

            this.children[i]._reverse(originalNextTimestamp, newPreviousTimestamp);

            originalNextTimestamp = originalStartTimestamp;
            newPreviousTimestamp = this.children[i].getEndTimestamp();
        }
    }
}

// An abstract class that TrackSegment extends to implement the GPXTreeElement interface
abstract class GPXTreeLeaf extends GPXTreeElement<GPXTreeLeaf> {
    isLeaf(): boolean {
        return true;
    }

    get children(): Array<GPXTreeLeaf> {
        return [];
    }
}

// A class that represents a GPX file
export class GPXFile extends GPXTreeNode<Track> {
    [immerable] = true;

    attributes: GPXFileAttributes;
    metadata: Metadata;
    wpt: Waypoint[];
    trk: Track[];
    rte: RouteType[];

    constructor(gpx?: GPXFileType & { _data?: any } | GPXFile) {
        super();
        if (gpx) {
            this.attributes = gpx.attributes
            this.metadata = gpx.metadata ?? {};
            this.metadata.author = {
                name: 'gpx.studio',
                link: {
                    attributes: {
                        href: 'https://gpx.studio',
                    }
                }
            };
            this.wpt = gpx.wpt ? gpx.wpt.map((waypoint) => new Waypoint(waypoint)) : [];
            this.trk = gpx.trk ? gpx.trk.map((track) => new Track(track)) : [];
            if (gpx.rte && gpx.rte.length > 0) {
                this.trk = this.trk.concat(gpx.rte.map((route) => convertRouteToTrack(route)));
            }
            if (gpx.hasOwnProperty('_data')) {
                this._data = gpx._data;
            }
            if (!this._data.hasOwnProperty('style')) {
                let style = this.getStyle();
                let fileStyle = {};
                if (style.color.length === 1) {
                    fileStyle['gpx_style:color'] = style.color[0];
                }
                if (style.opacity.length === 1) {
                    fileStyle['gpx_style:opacity'] = style.opacity[0];
                }
                if (style.width.length === 1) {
                    fileStyle['gpx_style:width'] = style.width[0];
                }
                if (Object.keys(fileStyle).length > 0) {
                    this.setStyle(fileStyle);
                }
            }
        } else {
            this.attributes = {};
            this.metadata = {};
            this.wpt = [];
            this.trk = [new Track()];
        }

        this.trk.forEach((track, trackIndex) => {
            track._data['trackIndex'] = trackIndex;
            track.trkseg.forEach((segment, segmentIndex) => {
                segment._data['trackIndex'] = trackIndex;
                segment._data['segmentIndex'] = segmentIndex;
            });
        });
        this.wpt.forEach((waypoint, waypointIndex) => {
            waypoint._data['index'] = waypointIndex;
        });
    }

    get children(): Array<Track> {
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

    getStyle(defaultColor?: string): MergedLineStyles {
        return this.trk.map((track) => track.getStyle()).reduce((acc, style) => {
            if (style && style["gpx_style:color"] && !acc.color.includes(style["gpx_style:color"])) {
                acc.color.push(style["gpx_style:color"]);
            } else if (defaultColor && !acc.color.includes(defaultColor)) {
                acc.color.push(defaultColor);
            }
            if (style && style["gpx_style:opacity"] && !acc.opacity.includes(style["gpx_style:opacity"])) {
                acc.opacity.push(style["gpx_style:opacity"]);
            }
            if (style && style["gpx_style:width"] && !acc.width.includes(style["gpx_style:width"])) {
                acc.width.push(style["gpx_style:width"]);
            }
            return acc;
        }, {
            color: [],
            opacity: [],
            width: []
        });
    }

    clone(): GPXFile {
        return new GPXFile({
            attributes: cloneJSON(this.attributes),
            metadata: cloneJSON(this.metadata),
            wpt: this.wpt.map((waypoint) => waypoint.clone()),
            trk: this.trk.map((track) => track.clone()),
            rte: [],
            _data: cloneJSON(this._data),
        });
    }

    toGeoJSON(): GeoJSON.FeatureCollection {
        return {
            type: "FeatureCollection",
            features: this.children.flatMap((child) => child.toGeoJSON())
        };
    }

    toGPXFileType(exclude: string[] = []): GPXFileType {
        let file: GPXFileType = {
            attributes: cloneJSON(this.attributes),
            metadata: {},
            wpt: this.wpt.map((wpt) => wpt.toWaypointType(exclude)),
            trk: this.trk.map((track) => track.toTrackType(exclude)),
            rte: [],
        };
        if (this.metadata) {
            if (this.metadata.name) {
                file.metadata.name = this.metadata.name;
            }
            if (this.metadata.desc) {
                file.metadata.desc = this.metadata.desc;
            }
            if (this.metadata.author) {
                file.metadata.author = cloneJSON(this.metadata.author);
            }
            if (this.metadata.link) {
                file.metadata.link = cloneJSON(this.metadata.link);
            }
            if (this.metadata.time && !exclude.includes('time')) {
                file.metadata.time = this.metadata.time;
            }
        }
        return file;
    }

    // Producers
    replaceTracks(start: number, end: number, tracks: Track[]) {
        if (this._data.style) {
            tracks.forEach((track) => track.setStyle(this._data.style, false));
        }
        this.trk.splice(start, end - start + 1, ...tracks);
    }

    replaceTrackSegments(trackIndex: number, start: number, end: number, segments: TrackSegment[]) {
        this.trk[trackIndex].replaceTrackSegments(start, end, segments);
    }

    replaceTrackPoints(trackIndex: number, segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date) {
        this.trk[trackIndex].replaceTrackPoints(segmentIndex, start, end, points, speed, startTime);
    }

    replaceWaypoints(start: number, end: number, waypoints: Waypoint[]) {
        this.wpt.splice(start, end - start + 1, ...waypoints);
    }

    reverse() {
        return this._reverse(this.getEndTimestamp(), this.getStartTimestamp());
    }

    reverseTrack(trackIndex: number) {
        this.trk[trackIndex]._reverse();
    }

    reverseTrackSegment(trackIndex: number, segmentIndex: number) {
        this.trk[trackIndex].reverseTrackSegment(segmentIndex);
    }

    roundTrip() {
        this.trk.forEach((track) => {
            track.roundTrip();
        });
    }

    roundTripTrack(trackIndex: number) {
        this.trk[trackIndex].roundTrip();
    }

    roundTripTrackSegment(trackIndex: number, segmentIndex: number) {
        this.trk[trackIndex].roundTripTrackSegment(segmentIndex);
    }

    crop(start: number, end: number, trackIndices?: number[], segmentIndices?: number[]) {
        let i = 0;
        let trackIndex = 0;
        while (i < this.trk.length) {
            let length = this.trk[i].getNumberOfTrackPoints();
            if (trackIndices === undefined || trackIndices.includes(trackIndex)) {
                if (start >= length || end < 0) {
                    this.trk.splice(i, 1);
                } else {
                    if (start > 0 || end < length - 1) {
                        this.trk[i].crop(Math.max(0, start), Math.min(length - 1, end), segmentIndices);
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
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean, deleteTrackPoints: boolean, deleteWaypoints: boolean, trackIndices?: number[], segmentIndices?: number[], waypointIndices?: number[]) {
        if (deleteTrackPoints) {
            let i = 0;
            let trackIndex = 0;
            while (i < this.trk.length) {
                if (trackIndices === undefined || trackIndices.includes(trackIndex)) {
                    this.trk[i].clean(bounds, inside, segmentIndices);
                    if (this.trk[i].getNumberOfTrackPoints() === 0) {
                        this.trk.splice(i, 1);
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }
                trackIndex++;
            }
        }
        if (deleteWaypoints) {
            let og = getOriginal(this); // Read as much as possible from the original object because it is faster
            let wpt = og.wpt.filter((point, waypointIndex) => {
                if (waypointIndices === undefined || waypointIndices.includes(waypointIndex)) {
                    let inBounds = point.attributes.lat >= bounds[0].lat && point.attributes.lat <= bounds[1].lat && point.attributes.lon >= bounds[0].lon && point.attributes.lon <= bounds[1].lon;
                    return inBounds !== inside;
                } else {
                    return true;
                }
            });
            this.wpt = freeze(wpt); // Pre-freeze the array, faster as well
        }
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, trackIndex?: number, segmentIndex?: number) {
        let lastPoint = undefined;
        this.trk.forEach((track, index) => {
            if (trackIndex === undefined || trackIndex === index) {
                track.changeTimestamps(startTime, speed, ratio, lastPoint, segmentIndex);
            }
        });
    }

    createArtificialTimestamps(startTime: Date, totalTime: number, trackIndex?: number, segmentIndex?: number) {
        let lastPoint = undefined;
        this.trk.forEach((track, index) => {
            if (trackIndex === undefined || trackIndex === index) {
                track.createArtificialTimestamps(startTime, totalTime, lastPoint, segmentIndex);
            }
        });
    }

    addElevation(elevations: number[], trackIndices?: number[], segmentIndices?: number[], waypointIndices?: number[]) {
        let index = 0;
        this.trk.forEach((track, trackIndex) => {
            if (trackIndices === undefined || trackIndices.includes(trackIndex)) {
                track.trkseg.forEach((segment, segmentIndex) => {
                    if (segmentIndices === undefined || segmentIndices.includes(segmentIndex)) {
                        segment.trkpt.forEach((point) => {
                            point.ele = elevations[index++];
                        });
                    }
                });
            }
        });
        this.wpt.forEach((waypoint, waypointIndex) => {
            if (waypointIndices === undefined || waypointIndices.includes(waypointIndex)) {
                waypoint.ele = elevations[index++];
            }
        });
        elevations.splice(0, index);
    }

    setStyle(style: LineStyleExtension) {
        this.trk.forEach((track) => {
            track.setStyle(style);
        });
        if (!this._data.style) {
            this._data.style = {};
        }
        if (style["gpx_style:color"]) {
            this._data.style.color = style["gpx_style:color"].replace('#', '');
        }
        if (style["gpx_style:opacity"]) {
            this._data.style.opacity = style["gpx_style:opacity"];
        }
        if (style["gpx_style:width"]) {
            this._data.style.width = style["gpx_style:width"];
        }
    }

    setHidden(hidden: boolean, trackIndices?: number[], segmentIndices?: number[]) {
        let allHidden = hidden;
        this.trk.forEach((track, index) => {
            if (trackIndices === undefined || trackIndices.includes(index)) {
                track.setHidden(hidden, segmentIndices);
            } else {
                allHidden = allHidden && (track._data.hidden === true);
            }
        });
        this.wpt.forEach((waypoint) => {
            if (trackIndices === undefined && segmentIndices === undefined) {
                waypoint.setHidden(hidden);
            } else {
                allHidden = allHidden && (waypoint._data.hidden === true);
            }
        });

        if (trackIndices === undefined && segmentIndices === undefined) {
            this._data.hiddenWpt = hidden;
        }

        this._data.hidden = allHidden;
    }

    setHiddenWaypoints(hidden: boolean, waypointIndices?: number[]) {
        let allHiddenWpt = hidden;
        this.wpt.forEach((waypoint, index) => {
            if (waypointIndices === undefined || waypointIndices.includes(index)) {
                waypoint.setHidden(hidden);
            } else {
                allHiddenWpt = allHiddenWpt && (waypoint._data.hidden === true);
            }
        });

        let allHiddenTrk = true;
        this.trk.forEach((track) => {
            allHiddenTrk = allHiddenTrk && (track._data.hidden === true);
        });

        this._data.hiddenWpt = allHiddenWpt;
        this._data.hidden = allHiddenTrk && allHiddenWpt;
    }
};

// A class that represents a Track in a GPX file
export class Track extends GPXTreeNode<TrackSegment> {
    [immerable] = true;

    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    extensions?: TrackExtensions;
    trkseg: TrackSegment[];

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

    get children(): Array<TrackSegment> {
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
            extensions: cloneJSON(this.extensions),
            trkseg: this.trkseg.map((seg) => seg.clone()),
            _data: cloneJSON(this._data),
        });
    }

    getStyle(): LineStyleExtension | undefined {
        if (this.extensions && this.extensions['gpx_style:line']) {
            if (this.extensions["gpx_style:line"]["gpx_style:color"]) {
                return {
                    ...this.extensions["gpx_style:line"],
                    ["gpx_style:color"]: `#${this.extensions["gpx_style:line"]["gpx_style:color"]}`
                }
            }
            return this.extensions['gpx_style:line'];
        }
        return undefined;
    }

    getValidStyle(): LineStyleExtension | undefined {
        if (this.extensions && this.extensions['gpx_style:line']) {
            return {
                "gpx_style:color": this.extensions['gpx_style:line']["gpx_style:color"],
                "gpx_style:opacity": this.extensions['gpx_style:line']["gpx_style:opacity"],
                "gpx_style:width": this.extensions['gpx_style:line']["gpx_style:width"]
            };
        }
        return undefined;
    }

    toGeoJSON(): GeoJSON.Feature[] {
        return this.children.map((child) => {
            let geoJSON = child.toGeoJSON();
            if (this.extensions && this.extensions['gpx_style:line']) {
                if (this.extensions['gpx_style:line']["gpx_style:color"]) {
                    geoJSON.properties['color'] = `#${this.extensions['gpx_style:line']["gpx_style:color"]}`;
                }
                if (this.extensions['gpx_style:line']["gpx_style:opacity"]) {
                    geoJSON.properties['opacity'] = this.extensions['gpx_style:line']["gpx_style:opacity"];
                }
                if (this.extensions['gpx_style:line']["gpx_style:width"]) {
                    geoJSON.properties['width'] = this.extensions['gpx_style:line']["gpx_style:width"];
                }
            }
            return geoJSON;
        });
    }

    toTrackType(exclude: string[] = []): TrackType {
        return {
            name: this.name,
            cmt: this.cmt,
            desc: this.desc,
            src: this.src,
            link: this.link,
            type: this.type,
            extensions: this.extensions && this.extensions['gpx_style:line'] ? {
                'gpx_style:line': this.getValidStyle()
            } : undefined,
            trkseg: this.trkseg.map((seg) => seg.toTrackSegmentType(exclude)),
        };
    }

    // Producers
    replaceTrackSegments(start: number, end: number, segments: TrackSegment[]) {
        this.trkseg.splice(start, end - start + 1, ...segments);
    }

    replaceTrackPoints(segmentIndex: number, start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date) {
        this.trkseg[segmentIndex].replaceTrackPoints(start, end, points, speed, startTime);
    }

    reverseTrackSegment(segmentIndex: number) {
        this.trkseg[segmentIndex]._reverse(this.trkseg[segmentIndex].getEndTimestamp(), this.trkseg[segmentIndex].getStartTimestamp());
    }

    roundTrip() {
        this.trkseg.forEach((segment) => {
            segment.roundTrip();
        });
    }

    roundTripTrackSegment(segmentIndex: number) {
        this.trkseg[segmentIndex].roundTrip();
    }

    crop(start: number, end: number, segmentIndices?: number[]) {
        let i = 0;
        let segmentIndex = 0;
        while (i < this.trkseg.length) {
            let length = this.trkseg[i].getNumberOfTrackPoints();
            if (segmentIndices === undefined || segmentIndices.includes(segmentIndex)) {
                if (start >= length || end < 0) {
                    this.trkseg.splice(i, 1);
                } else {
                    if (start > 0 || end < length - 1) {
                        this.trkseg[i].crop(Math.max(0, start), Math.min(length - 1, end));
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
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean, segmentIndices?: number[]) {
        let i = 0;
        let segmentIndex = 0;
        while (i < this.trkseg.length) {
            if (segmentIndices === undefined || segmentIndices.includes(segmentIndex)) {
                this.trkseg[i].clean(bounds, inside);
                if (this.trkseg[i].getNumberOfTrackPoints() === 0) {
                    this.trkseg.splice(i, 1);
                } else {
                    i++;
                }
            } else {
                i++;
            }
            segmentIndex++;
        }
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint, segmentIndex?: number) {
        this.trkseg.forEach((segment, index) => {
            if (segmentIndex === undefined || segmentIndex === index) {
                segment.changeTimestamps(startTime, speed, ratio, lastPoint);
                if (segment.trkpt.length > 0) {
                    lastPoint = segment.trkpt[segment.trkpt.length - 1];
                }
            }
        });
    }

    createArtificialTimestamps(startTime: Date, totalTime: number, lastPoint: TrackPoint | undefined, segmentIndex?: number) {
        this.trkseg.forEach((segment, index) => {
            if (segmentIndex === undefined || segmentIndex === index) {
                segment.createArtificialTimestamps(startTime, totalTime, lastPoint);
                if (segment.trkpt.length > 0) {
                    lastPoint = segment.trkpt[segment.trkpt.length - 1];
                }
            }
        });
    }

    setStyle(style: LineStyleExtension, force: boolean = true) {
        if (!this.extensions) {
            this.extensions = {};
        }
        if (!this.extensions['gpx_style:line']) {
            this.extensions['gpx_style:line'] = {};
        }
        if (style["gpx_style:color"] !== undefined && (force || this.extensions['gpx_style:line']["gpx_style:color"] === undefined)) {
            this.extensions['gpx_style:line']["gpx_style:color"] = style["gpx_style:color"].replace('#', '');
        }
        if (style["gpx_style:opacity"] !== undefined && (force || this.extensions['gpx_style:line']["gpx_style:opacity"] === undefined)) {
            this.extensions['gpx_style:line']["gpx_style:opacity"] = style["gpx_style:opacity"];
        }
        if (style["gpx_style:width"] !== undefined && (force || this.extensions['gpx_style:line']["gpx_style:width"] === undefined)) {
            this.extensions['gpx_style:line']["gpx_style:width"] = style["gpx_style:width"];
        }
    }

    setHidden(hidden: boolean, segmentIndices?: number[]) {
        let allHidden = hidden;
        this.trkseg.forEach((segment, index) => {
            if (segmentIndices === undefined || segmentIndices.includes(index)) {
                segment.setHidden(hidden);
            } else {
                allHidden = allHidden && (segment._data.hidden === true);
            }
        });
        this._data.hidden = allHidden;
    }
}

// A class that represents a TrackSegment in a GPX file
export class TrackSegment extends GPXTreeLeaf {
    [immerable] = true;

    trkpt: TrackPoint[];

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
        statistics.local.slope.at = this._computeSlope();

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
                statistics.local.time.total.push(0);
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

                if (speed >= 0.5 && speed <= 1500) {
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

            // extensions
            if (points[i].extensions) {
                if (points[i].extensions["gpxtpx:TrackPointExtension"] && points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:atemp"]) {
                    let atemp = points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:atemp"];
                    statistics.global.atemp.avg = (statistics.global.atemp.count * statistics.global.atemp.avg + atemp) / (statistics.global.atemp.count + 1);
                    statistics.global.atemp.count++;
                }
                if (points[i].extensions["gpxtpx:TrackPointExtension"] && points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:hr"]) {
                    let hr = points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:hr"];
                    statistics.global.hr.avg = (statistics.global.hr.count * statistics.global.hr.avg + hr) / (statistics.global.hr.count + 1);
                    statistics.global.hr.count++;
                }
                if (points[i].extensions["gpxtpx:TrackPointExtension"] && points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:cad"]) {
                    let cad = points[i].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:cad"];
                    statistics.global.cad.avg = (statistics.global.cad.count * statistics.global.cad.avg + cad) / (statistics.global.cad.count + 1);
                    statistics.global.cad.count++;
                }
                if (points[i].extensions["gpxpx:PowerExtension"] && points[i].extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"]) {
                    let power = points[i].extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"];
                    statistics.global.power.avg = (statistics.global.power.count * statistics.global.power.avg + power) / (statistics.global.power.count + 1);
                    statistics.global.power.count++;
                }
            }

            if (i > 0 && points[i - 1].extensions && points[i - 1].extensions["gpxtpx:TrackPointExtension"] && points[i - 1].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]) {
                Object.entries(points[i - 1].extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]).forEach(([key, value]) => {
                    if (statistics.global.extensions[key] === undefined) {
                        statistics.global.extensions[key] = {};
                    }
                    if (statistics.global.extensions[key][value] === undefined) {
                        statistics.global.extensions[key][value] = 0;
                    }
                    statistics.global.extensions[key][value] += dist;
                });
            }
        }

        [statistics.local.slope.segment, statistics.local.slope.length] = this._computeSlopeSegments(statistics);

        statistics.global.time.total = statistics.global.time.start && statistics.global.time.end ? (statistics.global.time.end.getTime() - statistics.global.time.start.getTime()) / 1000 : 0;
        statistics.global.speed.total = statistics.global.time.total > 0 ? statistics.global.distance.total / (statistics.global.time.total / 3600) : 0;
        statistics.global.speed.moving = statistics.global.time.moving > 0 ? statistics.global.distance.moving / (statistics.global.time.moving / 3600) : 0;

        statistics.local.speed = distanceWindowSmoothingWithDistanceAccumulator(points, 200, (accumulated, start, end) => (points[start].time && points[end].time) ? 3600 * accumulated / (points[end].time.getTime() - points[start].time.getTime()) : undefined);

        return statistics;
    }

    _computeSmoothedElevation(): number[] {
        const points = this.trkpt;

        let smoothed = distanceWindowSmoothing(points, 100, (index) => points[index].ele ?? 0, (accumulated, start, end) => accumulated / (end - start + 1));

        if (points.length > 0) {
            smoothed[0] = points[0].ele ?? 0;
            smoothed[points.length - 1] = points[points.length - 1].ele ?? 0;
        }

        return smoothed;
    }

    _computeSlope(): number[] {
        const points = this.trkpt;

        return distanceWindowSmoothingWithDistanceAccumulator(points, 50, (accumulated, start, end) => 100 * ((points[end].ele ?? 0) - (points[start].ele ?? 0)) / (accumulated > 0 ? accumulated : 1));
    }

    _computeSlopeSegments(statistics: GPXStatistics): [number[], number[]] {
        let simplified = ramerDouglasPeucker(this.trkpt, 20, getElevationDistanceFunction(statistics));

        let slope = [];
        let length = [];

        for (let i = 0; i < simplified.length - 1; i++) {
            let start = simplified[i].point._data.index;
            let end = simplified[i + 1].point._data.index;
            let dist = statistics.local.distance.total[end] - statistics.local.distance.total[start];
            let ele = (simplified[i + 1].point.ele ?? 0) - (simplified[i].point.ele ?? 0);

            for (let j = start; j < end + (i + 1 === simplified.length - 1 ? 1 : 0); j++) {
                slope.push(0.1 * ele / dist);
                length.push(dist);
            }
        }

        return [slope, length];
    }

    getNumberOfTrackPoints(): number {
        return this.trkpt.length;
    }

    getStartTimestamp(): Date | undefined {
        if (this.trkpt.length === 0) {
            return undefined;
        }
        return this.trkpt[0].time;
    }

    getEndTimestamp(): Date | undefined {
        if (this.trkpt.length === 0) {
            return undefined;
        }
        return this.trkpt[this.trkpt.length - 1].time;
    }

    getStatistics(): GPXStatistics {
        return this._computeStatistics();
    }

    getSegments(): TrackSegment[] {
        return [this];
    }

    getTrackPoints(): TrackPoint[] {
        return this.trkpt;
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

    toTrackSegmentType(exclude: string[] = []): TrackSegmentType {
        return {
            trkpt: this.trkpt.map((point) => point.toTrackPointType(exclude))
        };
    }

    clone(): TrackSegment {
        return new TrackSegment({
            trkpt: this.trkpt.map((point) => point.clone()),
            _data: cloneJSON(this._data),
        });
    }

    // Producers
    replaceTrackPoints(start: number, end: number, points: TrackPoint[], speed?: number, startTime?: Date, removeGaps?: boolean) {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let trkpt = og.trkpt.slice();

        if (speed !== undefined || (trkpt.length > 0 && trkpt[0].time !== undefined)) {
            // Must handle timestamps (either segment has timestamps or the new points will have timestamps)
            if (start > 0 && trkpt[0].time === undefined) {
                // Add timestamps to points before [start, end] because they are missing 
                trkpt.splice(0, 0, ...withTimestamps(trkpt.splice(0, start), speed, undefined, startTime));
            }
            if (points.length > 0) {
                // Adapt timestamps of the new points
                let last = start > 0 ? trkpt[start - 1] : undefined;
                if (points[0].time === undefined || (points.length > 1 && points[1].time === undefined)) {
                    // Add timestamps to the new points because they are missing
                    points = withTimestamps(points, speed, last, startTime);
                } else if (last !== undefined && points[0].time < last.time) {
                    // Adapt timestamps of the new points because they are too early
                    points = withShiftedAndCompressedTimestamps(points, speed, 1, last);
                } else if (last !== undefined && removeGaps) {
                    // Remove gaps between the new points and the previous point
                    if (last.getLatitude() === points[0].getLatitude() && last.getLongitude() === points[0].getLongitude()) {
                        // Same point, make the new points start at its timestamp and remove the first point
                        if (points[0].time > last.time) {
                            points = withShiftedAndCompressedTimestamps(points, speed, 1, last).slice(1);
                        }
                    } else {
                        // Different points, make the new points start one second after the previous point
                        if (points[0].time.getTime() - last.time.getTime() > 1000) {
                            let artificialLast = points[0].clone();
                            artificialLast.time = new Date(last.time.getTime() + 1000);
                            points = withShiftedAndCompressedTimestamps(points, speed, 1, artificialLast);
                        }
                    }
                }
            }
            if (end < trkpt.length - 1) {
                // Adapt timestamps of points after [start, end]
                let last = points.length > 0 ? points[points.length - 1] : start > 0 ? trkpt[start - 1] : undefined;
                if (trkpt[end + 1].time === undefined) {
                    // Add timestamps to points after [start, end] because they are missing
                    trkpt.splice(end + 1, 0, ...withTimestamps(trkpt.splice(end + 1), speed, last, startTime));
                } else if (last !== undefined && trkpt[end + 1].time < last.time) {
                    // Adapt timestamps of points after [start, end] because they are too early
                    trkpt.splice(end + 1, 0, ...withShiftedAndCompressedTimestamps(trkpt.splice(end + 1), speed, 1, last));
                }
            }
        }

        trkpt.splice(start, end - start + 1, ...points);
        this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
    }

    _reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date) {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let originalStartTimestamp = og.getStartTimestamp();
        let originalEndTimestamp = og.getEndTimestamp();
        if (!newPreviousTimestamp) {
            newPreviousTimestamp = originalStartTimestamp;
        }
        if (newPreviousTimestamp && originalEndTimestamp && !originalNextTimestamp) {
            originalNextTimestamp = new Date(newPreviousTimestamp.getTime() + originalEndTimestamp.getTime() - originalStartTimestamp.getTime());
        }
        if (originalNextTimestamp !== undefined && newPreviousTimestamp !== undefined && originalEndTimestamp !== undefined) {
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

            this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        } else {
            this.trkpt.reverse();
        }
    }

    roundTrip() {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let newSegment = og.clone();
        newSegment._reverse(newSegment.getEndTimestamp(), newSegment.getEndTimestamp());
        this.replaceTrackPoints(this.trkpt.length, this.trkpt.length, newSegment.trkpt);
    }

    crop(start: number, end: number) {
        this.trkpt = this.trkpt.slice(start, end + 1);
    }

    clean(bounds: [Coordinates, Coordinates], inside: boolean) {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let trkpt = og.trkpt.filter((point) => {
            let inBounds = point.attributes.lat >= bounds[0].lat && point.attributes.lat <= bounds[1].lat && point.attributes.lon >= bounds[0].lon && point.attributes.lon <= bounds[1].lon;
            return inBounds !== inside;
        });
        this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
    }

    changeTimestamps(startTime: Date, speed: number, ratio: number, lastPoint?: TrackPoint) {
        if (lastPoint === undefined && this.trkpt.length > 0) {
            lastPoint = this.trkpt[0].clone();
            lastPoint.time = startTime;
        }

        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        if (og.trkpt.length > 0 && og.trkpt[0].time === undefined) {
            let trkpt = withTimestamps(og.trkpt, speed, lastPoint, startTime);
            this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        } else {
            let trkpt = withShiftedAndCompressedTimestamps(og.trkpt, speed, ratio, lastPoint);
            this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        }
    }

    createArtificialTimestamps(startTime: Date, totalTime: number, lastPoint: TrackPoint | undefined) {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let slope = og._computeSlope();
        let trkpt = withArtificialTimestamps(og.trkpt, totalTime, lastPoint, startTime, slope);
        this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
    }

    setHidden(hidden: boolean) {
        this._data.hidden = hidden;
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

    getTemperature(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] : undefined;
    }

    getHeartRate(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] : undefined;
    }

    getCadence(): number {
        return this.extensions && this.extensions['gpxtpx:TrackPointExtension'] && this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] : undefined;
    }

    getPower(): number {
        return this.extensions && this.extensions["gpxpx:PowerExtension"] && this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] ? this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] : undefined;
    }

    setExtensions(extensions: Record<string, string>) {
        if (Object.keys(extensions).length === 0) {
            return;
        }
        if (!this.extensions) {
            this.extensions = {};
        }
        if (!this.extensions["gpxtpx:TrackPointExtension"]) {
            this.extensions["gpxtpx:TrackPointExtension"] = {};
        }
        if (!this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]) {
            this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] = {};
        }
        Object.entries(extensions).forEach(([key, value]) => {
            this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"][key] = value;
        });
    }

    getExtensions(): Record<string, string> {
        return this.extensions && this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] ? this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] : {};
    }

    toTrackPointType(exclude: string[] = []): TrackPointType {
        let trkpt: TrackPointType = {
            attributes: this.attributes,
            ele: this.ele,
        };
        if (!exclude.includes('time')) {
            trkpt = { ...trkpt, time: this.time };
        }
        if (this.extensions) {
            trkpt = {
                ...trkpt, extensions: {
                    "gpxtpx:TrackPointExtension": {},
                    "gpxpx:PowerExtension": {},
                }
            };
            if (this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:atemp"] && !exclude.includes('atemp')) {
                trkpt.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:atemp"] = this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:atemp"];
            }
            if (this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:hr"] && !exclude.includes('hr')) {
                trkpt.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:hr"] = this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:hr"];
            }
            if (this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:cad"] && !exclude.includes('cad')) {
                trkpt.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:cad"] = this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:cad"];
            }
            if (this.extensions["gpxpx:PowerExtension"] && this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] && !exclude.includes('power')) {
                trkpt.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"] = this.extensions["gpxpx:PowerExtension"]["gpxpx:PowerInWatts"];
            }
            if (this.extensions["gpxtpx:TrackPointExtension"] && this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] && !exclude.includes('extensions')) {
                trkpt.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"] = {};
                Object.entries(this.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"]).forEach(([key, value]) => {
                    trkpt.extensions["gpxtpx:TrackPointExtension"]["gpxtpx:Extensions"][key] = value;
                });
            }
        }
        return trkpt;
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

    constructor(waypoint: WaypointType & { _data?: any } | Waypoint) {
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

    toWaypointType(exclude: string[] = []): WaypointType {
        if (!exclude.includes('time')) {
            return {
                attributes: this.attributes,
                ele: this.ele,
                time: this.time,
                name: this.name,
                cmt: this.cmt,
                desc: this.desc,
                link: this.link,
                sym: this.sym,
                type: this.type,

            }
        } else {
            return {
                attributes: this.attributes,
                ele: this.ele,
                name: this.name,
                cmt: this.cmt,
                desc: this.desc,
                link: this.link,
                sym: this.sym,
                type: this.type,
            };
        }
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

    equals(other: Waypoint): boolean {
        if (this.attributes.lat !== other.attributes.lat || this.attributes.lon !== other.attributes.lon || this.ele !== other.ele ||
            this.name !== other.name || this.cmt !== other.cmt || this.desc !== other.desc || this.sym !== other.sym || this.type !== other.type) {
            return false;
        }

        if (this.time === undefined && other.time !== undefined || this.time !== undefined && other.time === undefined || this.time !== undefined && other.time !== undefined && this.time.getTime() !== other.time.getTime()) {
            return false;
        }

        if (JSON.stringify(this.link) !== JSON.stringify(other.link)) {
            return false;
        }

        return true;
    }

    // Producers
    setHidden(hidden: boolean) {
        this._data.hidden = hidden;
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
        atemp: {
            avg: number,
            count: number,
        },
        hr: {
            avg: number,
            count: number,
        },
        cad: {
            avg: number,
            count: number,
        },
        power: {
            avg: number,
            count: number,
        },
        extensions: Record<string, Record<string, number>>,
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
        slope: {
            at: number[],
            segment: number[],
            length: number[],
        }
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
            atemp: {
                avg: 0,
                count: 0,
            },
            hr: {
                avg: 0,
                count: 0,
            },
            cad: {
                avg: 0,
                count: 0,
            },
            power: {
                avg: 0,
                count: 0,
            },
            extensions: {},
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
            slope: {
                at: [],
                segment: [],
                length: [],
            }
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
        this.local.slope.at = this.local.slope.at.concat(other.local.slope.at);
        this.local.slope.segment = this.local.slope.segment.concat(other.local.slope.segment);
        this.local.slope.length = this.local.slope.length.concat(other.local.slope.length);

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

        this.global.atemp.avg = (this.global.atemp.count * this.global.atemp.avg + other.global.atemp.count * other.global.atemp.avg) / Math.max(1, this.global.atemp.count + other.global.atemp.count);
        this.global.atemp.count += other.global.atemp.count;
        this.global.hr.avg = (this.global.hr.count * this.global.hr.avg + other.global.hr.count * other.global.hr.avg) / Math.max(1, this.global.hr.count + other.global.hr.count);
        this.global.hr.count += other.global.hr.count;
        this.global.cad.avg = (this.global.cad.count * this.global.cad.avg + other.global.cad.count * other.global.cad.avg) / Math.max(1, this.global.cad.count + other.global.cad.count);
        this.global.cad.count += other.global.cad.count;
        this.global.power.avg = (this.global.power.count * this.global.power.avg + other.global.power.count * other.global.power.avg) / Math.max(1, this.global.power.count + other.global.power.count);
        this.global.power.count += other.global.power.count;
        Object.keys(other.global.extensions).forEach((extension) => {
            if (this.global.extensions[extension] === undefined) {
                this.global.extensions[extension] = {};
            }
            Object.keys(other.global.extensions[extension]).forEach((value) => {
                if (this.global.extensions[extension][value] === undefined) {
                    this.global.extensions[extension][value] = 0;
                }
                this.global.extensions[extension][value] += other.global.extensions[extension][value];
            });
        });
    }

    slice(start: number, end: number): GPXStatistics {
        if (start < 0) {
            start = 0;
        } else if (start >= this.local.points.length) {
            return new GPXStatistics();
        }
        if (end < start) {
            return new GPXStatistics();
        } else if (end >= this.local.points.length) {
            end = this.local.points.length - 1;
        }

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

        statistics.global.atemp = this.global.atemp;
        statistics.global.hr = this.global.hr;
        statistics.global.cad = this.global.cad;
        statistics.global.power = this.global.power;

        return statistics;
    }
}

const earthRadius = 6371008.8;
export function distance(coord1: TrackPoint | Coordinates, coord2: TrackPoint | Coordinates): number {
    if (coord1 instanceof TrackPoint) {
        coord1 = coord1.getCoordinates();
    }
    if (coord2 instanceof TrackPoint) {
        coord2 = coord2.getCoordinates();
    }
    const rad = Math.PI / 180;
    const lat1 = coord1.lat * rad;
    const lat2 = coord2.lat * rad;
    const a = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((coord2.lon - coord1.lon) * rad);
    const maxMeters = earthRadius * Math.acos(Math.min(a, 1));
    return maxMeters;
}

export function getElevationDistanceFunction(statistics: GPXStatistics) {
    // x-coordinates are given by: statistics.local.distance.total[point._data.index] * 1000
    // y-coordinates are given by: point.ele
    // Compute the distance between point3 and the line defined by point1 and point2
    return (point1: TrackPoint, point2: TrackPoint, point3: TrackPoint) => {
        if (point1.ele === undefined || point2.ele === undefined || point3.ele === undefined) {
            return 0;
        }
        let x1 = statistics.local.distance.total[point1._data.index] * 1000;
        let x2 = statistics.local.distance.total[point2._data.index] * 1000;
        let x3 = statistics.local.distance.total[point3._data.index] * 1000;
        let y1 = point1.ele;
        let y2 = point2.ele;
        let y3 = point3.ele;

        let dist = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
        if (dist === 0) {
            return Math.sqrt(Math.pow(x3 - x1, 2) + Math.pow(y3 - y1, 2));
        }

        return Math.abs((y2 - y1) * x3 - (x2 - x1) * y3 + x2 * y1 - y2 * x1) / dist;
    }
}

function distanceWindowSmoothing(points: TrackPoint[], distanceWindow: number, accumulate: (index: number) => number, compute: (accumulated: number, start: number, end: number) => number, remove?: (index: number) => number): number[] {
    let result = [];

    let start = 0, end = 0, accumulated = 0;
    for (var i = 0; i < points.length; i++) {
        while (start + 1 < i && distance(points[start].getCoordinates(), points[i].getCoordinates()) > distanceWindow) {
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
    let last = points[0];
    return points.map((point) => {
        let pt = point.clone();
        if (point.time === undefined) {
            pt.time = getTimestamp(last, point, speed);
        } else {
            pt.time = new Date(start.getTime() + ratio * (point.time.getTime() - points[0].time.getTime()));
        }
        last = pt;
        return pt;
    });
}

function withArtificialTimestamps(points: TrackPoint[], totalTime: number, lastPoint: TrackPoint | undefined, startTime: Date, slope: number[]): TrackPoint[] {
    let weight = [];
    let totalWeight = 0;

    for (let i = 0; i < points.length - 1; i++) {
        let dist = distance(points[i].getCoordinates(), points[i + 1].getCoordinates());
        let w = dist * (0.5 + 1 / (1 + Math.exp(- 0.2 * slope[i])));
        weight.push(w);
        totalWeight += w;
    }

    let last = lastPoint;
    return points.map((point, i) => {
        let pt = point.clone();
        if (i === 0) {
            pt.time = lastPoint?.time ?? startTime;
        } else {
            pt.time = new Date(last.time.getTime() + totalTime * 1000 * weight[i - 1] / totalWeight);
        }
        last = pt;
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

export type MergedLineStyles = {
    color: string[]
    opacity: number[],
    width: number[],
};

function convertRouteToTrack(route: RouteType): Track {
    const track = new Track({
        name: route.name,
        cmt: route.cmt,
        desc: route.desc,
        src: route.src,
        link: route.link,
        type: route.type,
        extensions: route.extensions,
        trkseg: [],
    });

    if (route.rtept) {
        const segment = new TrackSegment();

        route.rtept.forEach((rpt) => {
            if (rpt.extensions && rpt.extensions['gpxx:RoutePointExtension'] && rpt.extensions['gpxx:RoutePointExtension']["gpxx:rpt"]) {
                rpt.extensions['gpxx:RoutePointExtension']["gpxx:rpt"].forEach((rptExtension) => {
                    segment.trkpt.push(new TrackPoint({
                        attributes: rptExtension.attributes,
                    }));
                });
            } else {
                segment.trkpt.push(new TrackPoint({
                    attributes: rpt.attributes,
                    ele: rpt.ele,
                    time: rpt.time,
                }));
            }
        });

        track.trkseg.push(segment);
    }

    return track;
}
