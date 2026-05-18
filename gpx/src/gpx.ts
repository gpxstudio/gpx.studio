import { ramerDouglasPeucker } from './simplify';
import { GPXStatistics, GPXStatisticsGroup, TrackPointLocalStatistics } from './statistics';
import {
    Coordinates,
    GPXFileAttributes,
    GPXFileType,
    LineStyleExtension,
    Link,
    Metadata,
    RouteType,
    TrackExtensions,
    TrackPointExtensions,
    TrackPointType,
    TrackSegmentType,
    TrackType,
    WaypointType,
} from './types';
import { immerable, isDraft, original, freeze } from 'immer';

function cloneJSON<T>(obj: T): T {
    if (obj === undefined) {
        return undefined;
    }
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
    abstract getSegments(): TrackSegment[];
    abstract getTrackPoints(): TrackPoint[];

    abstract toGeoJSON():
        | GeoJSON.Feature
        | GeoJSON.Feature[]
        | GeoJSON.FeatureCollection
        | GeoJSON.FeatureCollection[];

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
            let originalStartTimestamp =
                og.children[og.children.length - i - 1].getStartTimestamp();

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

    constructor(gpx?: (GPXFileType & { _data?: any }) | GPXFile) {
        super();
        if (gpx) {
            this.attributes = gpx.attributes;
            this.metadata = gpx.metadata ?? {};
            this.metadata.author = {
                name: 'gpx.studio',
                link: {
                    attributes: {
                        href: 'https://gpx.studio',
                    },
                },
            };
            this.wpt = gpx.wpt
                ? gpx.wpt.map((waypoint, index) => new Waypoint(waypoint, index))
                : [];
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
    }

    get children(): Array<Track> {
        return this.trk;
    }

    getSegment(trackIndex: number, segmentIndex: number): TrackSegment {
        return this.trk[trackIndex].children[segmentIndex];
    }

    forEachSegment(
        callback: (segment: TrackSegment, trackIndex: number, segmentIndex: number) => void
    ) {
        this.trk.forEach((track, trackIndex) => {
            track.children.forEach((segment, segmentIndex) => {
                callback(segment, trackIndex, segmentIndex);
            });
        });
    }

    getStatistics(): GPXStatisticsGroup {
        let statistics = new GPXStatisticsGroup();
        this.forEachSegment((segment) => {
            statistics.add(segment.getStatistics());
        });
        return statistics;
    }

    getStyle(defaultColor?: string): MergedLineStyles {
        const style = this.trk
            .map((track) => track.getStyle())
            .reduce(
                (acc, style) => {
                    if (
                        style &&
                        style['gpx_style:color'] &&
                        !acc.color.includes(style['gpx_style:color'])
                    ) {
                        acc.color.push(style['gpx_style:color']);
                    }
                    if (
                        style &&
                        style['gpx_style:opacity'] &&
                        !acc.opacity.includes(style['gpx_style:opacity'])
                    ) {
                        acc.opacity.push(style['gpx_style:opacity']);
                    }
                    if (
                        style &&
                        style['gpx_style:width'] &&
                        !acc.width.includes(style['gpx_style:width'])
                    ) {
                        acc.width.push(style['gpx_style:width']);
                    }
                    return acc;
                },
                {
                    color: [],
                    opacity: [],
                    width: [],
                }
            );
        if (style.color.length === 0 && defaultColor) {
            style.color.push(defaultColor);
        }
        return style;
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
            type: 'FeatureCollection',
            features: this.children.flatMap((child) => child.toGeoJSON()),
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

    replaceTrackPoints(
        trackIndex: number,
        segmentIndex: number,
        start: number,
        end: number,
        points: TrackPoint[],
        speed?: number,
        startTime?: Date
    ) {
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
                        this.trk[i].crop(
                            Math.max(0, start),
                            Math.min(length - 1, end),
                            segmentIndices
                        );
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

    clean(
        bounds: [Coordinates, Coordinates],
        inside: boolean,
        deleteTrackPoints: boolean,
        deleteWaypoints: boolean,
        trackIndices?: number[],
        segmentIndices?: number[],
        waypointIndices?: number[]
    ) {
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
                    let inBounds =
                        point.attributes.lat >= bounds[0].lat &&
                        point.attributes.lat <= bounds[1].lat &&
                        point.attributes.lon >= bounds[0].lon &&
                        point.attributes.lon <= bounds[1].lon;
                    return inBounds !== inside;
                } else {
                    return true;
                }
            });
            this.wpt = freeze(wpt); // Pre-freeze the array, faster as well
        }
    }

    changeTimestamps(
        startTime: Date,
        speed: number,
        ratio: number,
        lastPoint?: TrackPoint,
        trackIndex?: number,
        segmentIndex?: number,
        selectionItems: ArtificialTimestampSelectionItem[] = []
    ): TrackPoint | undefined {
        if (selectionItems.length === 0) {
            selectionItems = [{ kind: 'file' }];
        }

        if (selectionItems.some((item) => item.kind === 'file')) {
            // the whole file is selected: chain all tracks in file order
            this.trk.forEach((track) => {
                lastPoint = track.changeTimestamps(startTime, speed, ratio, lastPoint);
            });
            return lastPoint;
        }

        const selectedTracks = selectionItems.filter(
            (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'track' }> =>
                item.kind === 'track'
        );
        if (selectedTracks.length > 0) {
            // only some tracks are selected, so process them as one ordered batch
            const tracks = selectedTracks
                .map((item) => this.trk[item.trackIndex])
                .filter((track): track is Track => track !== undefined);
            tracks.forEach((track) => {
                lastPoint = track.changeTimestamps(startTime, speed, ratio, lastPoint);
            });
            return lastPoint;
        }

        const selectedSegments = selectionItems
            .filter(
                (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'segment' }> =>
                    item.kind === 'segment'
            )
            .sort((a, b) =>
                a.trackIndex === b.trackIndex
                    ? a.segmentIndex - b.segmentIndex
                    : a.trackIndex - b.trackIndex
            );
        if (selectedSegments.length > 0) {
            // only some segments are selected, so process them as one ordered batch
            selectedSegments.forEach((item) => {
                const segment = this.trk[item.trackIndex]?.trkseg[item.segmentIndex];
                if (segment) {
                    lastPoint = segment.changeTimestamps(startTime, speed, ratio, lastPoint);
                }
            });
            return lastPoint;
        }
        return lastPoint;
    }

    createArtificialTimestamps(
        startTime: Date,
        totalTime: number,
        lastPoint?: TrackPoint,
        trackIndex?: number,
        segmentIndex?: number,
        selectionItems: ArtificialTimestampSelectionItem[] = []
    ): TrackPoint | undefined {
        if (selectionItems.length === 0) {
            selectionItems = [{ kind: 'file' }];
        }

        if (selectionItems.some((item) => item.kind === 'file')) {
            // the whole file is selected: first distribute time across tracks
            const tracks = this.trk.map((track) => ({
                track,
                weight: getArtificialTimestampWeightForTrack(track),
            }));

            const totalWeight = tracks.reduce((acc, entry) => acc + entry.weight, 0);
            tracks.forEach((entry) => {
                // using its weight proportion and the total time budget, allocate time
                const allocatedTime =
                    totalWeight > 0
                        ? (totalTime * entry.weight) / totalWeight
                        : tracks.length > 0
                          ? totalTime / tracks.length
                          : totalTime;
                // apply the allocated time budget
                lastPoint = entry.track.createArtificialTimestamps(
                    startTime,
                    allocatedTime,
                    lastPoint
                );
            });
            return lastPoint;
        }

        const selectedTracks = selectionItems.filter(
            (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'track' }> =>
                item.kind === 'track'
        );
        if (selectedTracks.length > 0) {
            // only some tracks are selected, so distribute the budget across them
            const tracks = selectedTracks
                .map((item) => ({
                    item,
                    track: this.trk[item.trackIndex],
                    weight: this.trk[item.trackIndex]
                        ? getArtificialTimestampWeightForTrack(this.trk[item.trackIndex])
                        : 0,
                }))
                .filter(({ track }) => track !== undefined);
            const totalWeight = tracks.reduce((acc, entry) => acc + entry.weight, 0);
            tracks.forEach((entry) => {
                const allocatedTime =
                    totalWeight > 0
                        ? (totalTime * entry.weight) / totalWeight
                        : tracks.length > 0
                          ? totalTime / tracks.length
                          : totalTime;
                lastPoint = entry.track.createArtificialTimestamps(
                    startTime,
                    allocatedTime,
                    lastPoint
                );
            });
            return lastPoint;
        }

        const selectedSegments = selectionItems
            .filter(
                (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'segment' }> =>
                    item.kind === 'segment'
            )
            .sort((a, b) =>
                a.trackIndex === b.trackIndex
                    ? a.segmentIndex - b.segmentIndex
                    : a.trackIndex - b.trackIndex
            );
        if (selectedSegments.length > 0) {
            // only some segments are selected, so distribute the budget across them
            const segments = selectedSegments
                .map((item) => {
                    const segment = this.trk[item.trackIndex]?.trkseg[item.segmentIndex];
                    return {
                        item,
                        segment,
                        weight: segment
                            ? getArtificialTimestampWeight(
                                  segment.getTrackPoints(),
                                  segment.getStatistics()
                              )
                            : 0,
                    };
                })
                .filter(({ segment }) => segment !== undefined);
            const totalWeight = segments.reduce((acc, entry) => acc + entry.weight, 0);
            segments.forEach((entry) => {
                const allocatedTime =
                    totalWeight > 0
                        ? (totalTime * entry.weight) / totalWeight
                        : segments.length > 0
                          ? totalTime / segments.length
                          : totalTime;
                lastPoint = entry.segment.createArtificialTimestamps(
                    startTime,
                    allocatedTime,
                    lastPoint
                );
            });
            return lastPoint;
        }

        return lastPoint;
    }

    clearTimestamps(trackIndex?: number, segmentIndex?: number) {
        this.trk.forEach((track, index) => {
            if (trackIndex === undefined || trackIndex === index) {
                track.clearTimestamps(segmentIndex);
            }
        });
    }

    addElevation(
        elevations: number[],
        trackIndices?: number[],
        segmentIndices?: number[],
        waypointIndices?: number[]
    ) {
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
        if (style['gpx_style:color']) {
            this._data.style.color = style['gpx_style:color'].replace('#', '');
        }
        if (style['gpx_style:opacity']) {
            this._data.style.opacity = style['gpx_style:opacity'];
        }
        if (style['gpx_style:width']) {
            this._data.style.width = style['gpx_style:width'];
        }
    }

    setHidden(hidden: boolean, trackIndices?: number[], segmentIndices?: number[]) {
        let allHidden = hidden;
        this.trk.forEach((track, index) => {
            if (trackIndices === undefined || trackIndices.includes(index)) {
                track.setHidden(hidden, segmentIndices);
            } else {
                allHidden = allHidden && track._data.hidden === true;
            }
        });
        this.wpt.forEach((waypoint) => {
            if (trackIndices === undefined && segmentIndices === undefined) {
                waypoint.setHidden(hidden);
            } else {
                allHidden = allHidden && waypoint._data.hidden === true;
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
                allHiddenWpt = allHiddenWpt && waypoint._data.hidden === true;
            }
        });

        let allHiddenTrk = true;
        this.trk.forEach((track) => {
            allHiddenTrk = allHiddenTrk && track._data.hidden === true;
        });

        this._data.hiddenWpt = allHiddenWpt;
        this._data.hidden = allHiddenTrk && allHiddenWpt;
    }
}

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

    constructor(track?: (TrackType & { _data?: any }) | Track) {
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
            if (this.extensions['gpx_style:line']['gpx_style:color']) {
                return {
                    ...this.extensions['gpx_style:line'],
                    ['gpx_style:color']: `#${this.extensions['gpx_style:line']['gpx_style:color']}`,
                };
            }
            return this.extensions['gpx_style:line'];
        }
        return undefined;
    }

    getValidStyle(): LineStyleExtension | undefined {
        if (this.extensions && this.extensions['gpx_style:line']) {
            return {
                'gpx_style:color': this.extensions['gpx_style:line']['gpx_style:color'],
                'gpx_style:opacity': this.extensions['gpx_style:line']['gpx_style:opacity'],
                'gpx_style:width': this.extensions['gpx_style:line']['gpx_style:width'],
            };
        }
        return undefined;
    }

    toGeoJSON(): GeoJSON.Feature[] {
        return this.children.map((child) => {
            let geoJSON = child.toGeoJSON();
            if (this.extensions && this.extensions['gpx_style:line']) {
                if (this.extensions['gpx_style:line']['gpx_style:color']) {
                    geoJSON.properties['color'] =
                        `#${this.extensions['gpx_style:line']['gpx_style:color']}`;
                }
                if (this.extensions['gpx_style:line']['gpx_style:opacity']) {
                    geoJSON.properties['opacity'] =
                        this.extensions['gpx_style:line']['gpx_style:opacity'];
                }
                if (this.extensions['gpx_style:line']['gpx_style:width']) {
                    geoJSON.properties['width'] =
                        this.extensions['gpx_style:line']['gpx_style:width'];
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
            extensions:
                this.extensions && this.extensions['gpx_style:line']
                    ? {
                          'gpx_style:line': this.getValidStyle(),
                      }
                    : undefined,
            trkseg: this.trkseg.map((seg) => seg.toTrackSegmentType(exclude)),
        };
    }

    // Producers
    replaceTrackSegments(start: number, end: number, segments: TrackSegment[]) {
        this.trkseg.splice(start, end - start + 1, ...segments);
    }

    replaceTrackPoints(
        segmentIndex: number,
        start: number,
        end: number,
        points: TrackPoint[],
        speed?: number,
        startTime?: Date
    ) {
        this.trkseg[segmentIndex].replaceTrackPoints(start, end, points, speed, startTime);
    }

    reverseTrackSegment(segmentIndex: number) {
        this.trkseg[segmentIndex]._reverse(
            this.trkseg[segmentIndex].getEndTimestamp(),
            this.trkseg[segmentIndex].getStartTimestamp()
        );
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

    changeTimestamps(
        startTime: Date,
        speed: number,
        ratio: number,
        lastPoint?: TrackPoint,
        segmentIndex?: number
    ): TrackPoint | undefined {
        this.trkseg.forEach((segment, index) => {
            if (segmentIndex === undefined || segmentIndex === index) {
                lastPoint = segment.changeTimestamps(startTime, speed, ratio, lastPoint);
            }
        });
        // pass through to next Track
        return lastPoint;
    }

    createArtificialTimestamps(
        startTime: Date,
        totalTime: number,
        lastPoint: TrackPoint | undefined,
        segmentIndex?: number
    ): TrackPoint | undefined {
        if (segmentIndex === undefined) {
            // the whole track is selected
            // calculate the slope and distance dependent weights for each segment
            const segments = this.trkseg.map((segment) => ({
                segment,
                weight: getArtificialTimestampWeight(
                    segment.getTrackPoints(),
                    segment.getStatistics()
                ),
            }));

            const totalWeight = segments.reduce((acc, entry) => acc + entry.weight, 0);
            segments.forEach((entry) => {
                // using its weight proportion and the total time budget, allocate time
                const allocatedTime =
                    totalWeight > 0
                        ? (totalTime * entry.weight) / totalWeight
                        : segments.length > 0
                          ? totalTime / segments.length
                          : totalTime;
                // apply the allocated time budget
                lastPoint = entry.segment.createArtificialTimestamps(
                    startTime,
                    allocatedTime,
                    lastPoint
                );
            });
            return lastPoint;
        }

        if (this.trkseg[segmentIndex] === undefined) {
            return lastPoint;
        }

        return this.trkseg[segmentIndex].createArtificialTimestamps(
            startTime,
            totalTime,
            lastPoint
        );
    }

    clearTimestamps(segmentIndex?: number) {
        this.trkseg.forEach((segment, index) => {
            if (segmentIndex === undefined || segmentIndex === index) {
                segment.clearTimestamps();
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
        if (
            style['gpx_style:color'] !== undefined &&
            (force || this.extensions['gpx_style:line']['gpx_style:color'] === undefined)
        ) {
            this.extensions['gpx_style:line']['gpx_style:color'] = style['gpx_style:color'].replace(
                '#',
                ''
            );
        }
        if (
            style['gpx_style:opacity'] !== undefined &&
            (force || this.extensions['gpx_style:line']['gpx_style:opacity'] === undefined)
        ) {
            this.extensions['gpx_style:line']['gpx_style:opacity'] = style['gpx_style:opacity'];
        }
        if (
            style['gpx_style:width'] !== undefined &&
            (force || this.extensions['gpx_style:line']['gpx_style:width'] === undefined)
        ) {
            this.extensions['gpx_style:line']['gpx_style:width'] = style['gpx_style:width'];
        }
    }

    setHidden(hidden: boolean, segmentIndices?: number[]) {
        let allHidden = hidden;
        this.trkseg.forEach((segment, index) => {
            if (segmentIndices === undefined || segmentIndices.includes(index)) {
                segment.setHidden(hidden);
            } else {
                allHidden = allHidden && segment._data.hidden === true;
            }
        });
        this._data.hidden = allHidden;
    }
}

// A class that represents a TrackSegment in a GPX file
export class TrackSegment extends GPXTreeLeaf {
    [immerable] = true;

    trkpt: TrackPoint[];

    constructor(segment?: (TrackSegmentType & { _data?: any }) | TrackSegment) {
        super();
        if (segment) {
            this.trkpt = segment.trkpt.map((point, index) => new TrackPoint(point, index));
            if (segment.hasOwnProperty('_data')) {
                this._data = segment._data;
            }
        } else {
            this.trkpt = [];
        }
    }

    _computeStatistics(): GPXStatistics {
        let statistics = new GPXStatistics();

        statistics.global.length = this.trkpt.length;
        statistics.local.points = this.trkpt.slice(0);
        statistics.local.data = this.trkpt.map(() => new TrackPointLocalStatistics());

        const points = this.trkpt;
        for (let i = 0; i < points.length; i++) {
            // distance
            let dist = 0;
            if (i > 0) {
                dist = distance(points[i - 1].getCoordinates(), points[i].getCoordinates()) / 1000;

                statistics.global.distance.total += dist;
            }

            statistics.local.data[i].distance.total = statistics.global.distance.total;

            // time
            if (points[i].time === undefined) {
                statistics.local.data[i].time.total = 0;
            } else {
                if (statistics.global.time.start === undefined) {
                    statistics.global.time.start = points[i].time;
                }
                statistics.global.time.end = points[i].time;
                statistics.local.data[i].time.total =
                    (points[i].time.getTime() - statistics.global.time.start.getTime()) / 1000;
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

            statistics.local.data[i].distance.moving = statistics.global.distance.moving;
            statistics.local.data[i].time.moving = statistics.global.time.moving;

            // bounds
            statistics.global.bounds.southWest.lat = Math.min(
                statistics.global.bounds.southWest.lat,
                points[i].attributes.lat
            );
            statistics.global.bounds.southWest.lon = Math.min(
                statistics.global.bounds.southWest.lon,
                points[i].attributes.lon
            );
            statistics.global.bounds.northEast.lat = Math.max(
                statistics.global.bounds.northEast.lat,
                points[i].attributes.lat
            );
            statistics.global.bounds.northEast.lon = Math.max(
                statistics.global.bounds.northEast.lon,
                points[i].attributes.lon
            );

            // extensions
            if (points[i].extensions) {
                if (
                    points[i].extensions['gpxtpx:TrackPointExtension'] &&
                    points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp']
                ) {
                    let atemp = points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'];
                    statistics.global.atemp.avg =
                        (statistics.global.atemp.count * statistics.global.atemp.avg + atemp) /
                        (statistics.global.atemp.count + 1);
                    statistics.global.atemp.count++;
                }
                if (
                    points[i].extensions['gpxtpx:TrackPointExtension'] &&
                    points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr']
                ) {
                    let hr = points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'];
                    statistics.global.hr.avg =
                        (statistics.global.hr.count * statistics.global.hr.avg + hr) /
                        (statistics.global.hr.count + 1);
                    statistics.global.hr.count++;
                }
                if (
                    points[i].extensions['gpxtpx:TrackPointExtension'] &&
                    points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad']
                ) {
                    let cad = points[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'];
                    statistics.global.cad.avg =
                        (statistics.global.cad.count * statistics.global.cad.avg + cad) /
                        (statistics.global.cad.count + 1);
                    statistics.global.cad.count++;
                }
                if (
                    points[i].extensions['gpxpx:PowerExtension'] &&
                    points[i].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']
                ) {
                    let power = points[i].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts'];
                    statistics.global.power.avg =
                        (statistics.global.power.count * statistics.global.power.avg + power) /
                        (statistics.global.power.count + 1);
                    statistics.global.power.count++;
                }
            }

            if (
                i > 0 &&
                points[i - 1].extensions &&
                points[i - 1].extensions['gpxtpx:TrackPointExtension'] &&
                points[i - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']
            ) {
                Object.entries(
                    points[i - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']
                ).forEach(([key, value]) => {
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

        this._elevationComputation(statistics);

        statistics.global.time.total =
            statistics.global.time.start && statistics.global.time.end
                ? (statistics.global.time.end.getTime() - statistics.global.time.start.getTime()) /
                  1000
                : 0;
        statistics.global.speed.total =
            statistics.global.time.total > 0
                ? statistics.global.distance.total / (statistics.global.time.total / 3600)
                : 0;
        statistics.global.speed.moving =
            statistics.global.time.moving > 0
                ? statistics.global.distance.moving / (statistics.global.time.moving / 3600)
                : 0;

        timeWindowSmoothing(
            points,
            10000,
            (start, end) =>
                points[start].time && points[end].time
                    ? (3600 *
                          (statistics.local.data[end].distance.total -
                              statistics.local.data[start].distance.total)) /
                      Math.max(
                          (points[end].time.getTime() - points[start].time.getTime()) / 1000,
                          1
                      )
                    : undefined,
            (value, index) => {
                statistics.local.data[index].speed = value;
            }
        );

        return statistics;
    }

    _elevationComputation(statistics: GPXStatistics) {
        let simplified = ramerDouglasPeucker(
            this.trkpt,
            20,
            getElevationDistanceFunction(statistics)
        );

        for (let i = 0; i < simplified.length - 1; i++) {
            let start = simplified[i].point._data.index;
            let end = simplified[i + 1].point._data.index;

            let cumulEle = 0;
            let currentStart = start;
            let currentEnd = start;
            let prevSmoothedEle = 0;
            distanceWindowSmoothing(
                start,
                end + 1,
                statistics,
                0.1,
                (s, e) => {
                    for (let i = currentStart; i < s; i++) {
                        cumulEle -= this.trkpt[i].ele ?? 0;
                    }
                    for (let i = currentEnd; i <= e; i++) {
                        cumulEle += this.trkpt[i].ele ?? 0;
                    }
                    currentStart = s;
                    currentEnd = e + 1;
                    return cumulEle / (e - s + 1);
                },
                (smoothedEle, j) => {
                    if (j === start) {
                        smoothedEle = this.trkpt[start].ele ?? 0;
                        prevSmoothedEle = smoothedEle;
                    } else if (j === end) {
                        smoothedEle = this.trkpt[end].ele ?? 0;
                    }
                    const ele = smoothedEle - prevSmoothedEle;
                    if (ele > 0) {
                        statistics.global.elevation.gain += ele;
                    } else if (ele < 0) {
                        statistics.global.elevation.loss -= ele;
                    }
                    prevSmoothedEle = smoothedEle;
                    if (j < end) {
                        statistics.local.data[j].elevation.gain = statistics.global.elevation.gain;
                        statistics.local.data[j].elevation.loss = statistics.global.elevation.loss;
                    }
                }
            );
        }
        if (statistics.global.length > 0) {
            statistics.local.data[statistics.global.length - 1].elevation.gain =
                statistics.global.elevation.gain;
            statistics.local.data[statistics.global.length - 1].elevation.loss =
                statistics.global.elevation.loss;
        }

        for (let i = 0; i < simplified.length - 1; i++) {
            let start = simplified[i].point._data.index;
            let end = simplified[i + 1].point._data.index;
            let dist =
                statistics.local.data[end].distance.total -
                statistics.local.data[start].distance.total;
            let ele = (simplified[i + 1].point.ele ?? 0) - (simplified[i].point.ele ?? 0);
            for (let j = start; j < end + (i + 1 === simplified.length - 1 ? 1 : 0); j++) {
                statistics.local.data[j].slope.segment = (0.1 * ele) / dist;
                statistics.local.data[j].slope.length = dist;
            }
        }

        distanceWindowSmoothing(
            0,
            this.trkpt.length,
            statistics,
            0.05,
            (start, end) => {
                const ele = this.trkpt[end].ele - this.trkpt[start].ele || 0;
                const dist =
                    statistics.local.data[end].distance.total -
                    statistics.local.data[start].distance.total;
                return dist > 0 ? (0.1 * ele) / dist : 0;
            },
            (value, index) => {
                statistics.local.data[index].slope.at = value;
            }
        );
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
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: this.trkpt.map((point) => [
                    point.attributes.lon,
                    point.attributes.lat,
                ]),
            },
            properties: {},
        };
    }

    toTrackSegmentType(exclude: string[] = []): TrackSegmentType {
        return {
            trkpt: this.trkpt.map((point) => point.toTrackPointType(exclude)),
        };
    }

    clone(): TrackSegment {
        return new TrackSegment({
            trkpt: this.trkpt.map((point) => point.clone()),
            _data: cloneJSON(this._data),
        });
    }

    // Producers
    replaceTrackPoints(
        start: number,
        end: number,
        points: TrackPoint[],
        speed?: number,
        startTime?: Date,
        removeGaps?: boolean
    ) {
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let trkpt = og.trkpt.slice();

        if (speed !== undefined || (trkpt.length > 0 && trkpt[0].time !== undefined)) {
            // Must handle timestamps (either segment has timestamps or the new points will have timestamps)
            if (start > 0 && trkpt[0].time === undefined) {
                // Add timestamps to points before [start, end] because they are missing
                trkpt.splice(
                    0,
                    0,
                    ...withTimestamps(trkpt.splice(0, start), speed, undefined, startTime)
                );
            }
            if (points.length > 0) {
                // Adapt timestamps of the new points
                let last = start > 0 ? trkpt[start - 1] : undefined;
                if (
                    points[0].time === undefined ||
                    (points.length > 1 && points[1].time === undefined)
                ) {
                    // Add timestamps to the new points because they are missing
                    points = withTimestamps(points, speed, last, startTime);
                } else if (last !== undefined && points[0].time < last.time) {
                    // Adapt timestamps of the new points because they are too early
                    points = withShiftedAndCompressedTimestamps(points, speed, 1, last);
                } else if (last !== undefined && removeGaps) {
                    // Remove gaps between the new points and the previous point
                    if (
                        last.getLatitude() === points[0].getLatitude() &&
                        last.getLongitude() === points[0].getLongitude()
                    ) {
                        // Same point, make the new points start at its timestamp and remove the first point
                        if (points[0].time > last.time) {
                            points = withShiftedAndCompressedTimestamps(
                                points,
                                speed,
                                1,
                                last
                            ).slice(1);
                        }
                    } else {
                        // Different points, make the new points start one second after the previous point
                        if (points[0].time.getTime() - last.time.getTime() > 1000) {
                            let artificialLast = points[0].clone();
                            artificialLast.time = new Date(last.time.getTime() + 1000);
                            points = withShiftedAndCompressedTimestamps(
                                points,
                                speed,
                                1,
                                artificialLast
                            );
                        }
                    }
                }
            }
            if (end < trkpt.length - 1) {
                // Adapt timestamps of points after [start, end]
                let last =
                    points.length > 0
                        ? points[points.length - 1]
                        : start > 0
                          ? trkpt[start - 1]
                          : undefined;
                if (trkpt[end + 1].time === undefined) {
                    // Add timestamps to points after [start, end] because they are missing
                    trkpt.splice(
                        end + 1,
                        0,
                        ...withTimestamps(trkpt.splice(end + 1), speed, last, startTime)
                    );
                } else if (last !== undefined && trkpt[end + 1].time < last.time) {
                    // Adapt timestamps of points after [start, end] because they are too early
                    trkpt.splice(
                        end + 1,
                        0,
                        ...withShiftedAndCompressedTimestamps(trkpt.splice(end + 1), speed, 1, last)
                    );
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
            originalNextTimestamp = new Date(
                newPreviousTimestamp.getTime() +
                    originalEndTimestamp.getTime() -
                    originalStartTimestamp.getTime()
            );
        }
        if (
            originalNextTimestamp !== undefined &&
            newPreviousTimestamp !== undefined &&
            originalEndTimestamp !== undefined
        ) {
            let newStartTimestamp = new Date(
                newPreviousTimestamp.getTime() +
                    originalNextTimestamp.getTime() -
                    originalEndTimestamp.getTime()
            );

            let trkpt = og.trkpt.map(
                (point, i) =>
                    new TrackPoint({
                        attributes: cloneJSON(point.attributes),
                        ele: point.ele,
                        time: new Date(
                            newStartTimestamp.getTime() +
                                (originalEndTimestamp.getTime() - og.trkpt[i].time.getTime())
                        ),
                        extensions: cloneJSON(point.extensions),
                        _data: cloneJSON(point._data),
                    })
            );

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
            let inBounds =
                point.attributes.lat >= bounds[0].lat &&
                point.attributes.lat <= bounds[1].lat &&
                point.attributes.lon >= bounds[0].lon &&
                point.attributes.lon <= bounds[1].lon;
            return inBounds !== inside;
        });
        this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
    }

    changeTimestamps(
        startTime: Date,
        speed: number,
        ratio: number,
        lastPoint?: TrackPoint
    ): TrackPoint | undefined {
        // lastPoint is the _previous_ last point, which we will _continue from_
        if (this.trkpt.length === 0) {
            return lastPoint; // pass through for empty segments
        }
        if (lastPoint === undefined) {
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
        // return the last point of this segment, which will become the start point of the next one
        return this.trkpt[this.trkpt.length - 1];
    }

    createArtificialTimestamps(
        startTime: Date,
        totalTime: number,
        lastPoint: TrackPoint | undefined
    ): TrackPoint | undefined {
        // lastPoint is the _previous_ last point, which we will _continue from_
        if (this.trkpt.length === 0) {
            return lastPoint; // pass through for empty segments
        }
        let og = getOriginal(this); // Read as much as possible from the original object because it is faster
        let statistics = og._computeStatistics();
        let trkpt = withArtificialTimestamps(og.trkpt, totalTime, lastPoint, startTime, statistics);
        this.trkpt = freeze(trkpt); // Pre-freeze the array, faster as well
        // return the last point of this segment, which will become the start point of the next one
        return this.trkpt[this.trkpt.length - 1];
    }

    clearTimestamps() {
        let og = getOriginal(this);
        this.trkpt = freeze(
            og.trkpt.map((point) => {
                let cloned = point.clone();
                cloned.time = undefined;
                return cloned;
            })
        );
    }

    setHidden(hidden: boolean) {
        this._data.hidden = hidden;
    }
}

const emptyExtensions: Record<string, string> = {};
export class TrackPoint {
    [immerable] = true;

    attributes: Coordinates;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;

    _data: { [key: string]: any } = {};

    constructor(point: (TrackPointType & { _data?: any }) | TrackPoint, index?: number) {
        this.attributes = point.attributes;
        this.ele = point.ele;
        this.time = point.time;
        this.extensions = point.extensions;
        if (point.hasOwnProperty('_data')) {
            this._data = point._data;
        }
        if (index !== undefined) {
            this._data.index = index;
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
        return this.extensions &&
            this.extensions['gpxtpx:TrackPointExtension'] &&
            this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp']
            ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp']
            : undefined;
    }

    getHeartRate(): number {
        return this.extensions &&
            this.extensions['gpxtpx:TrackPointExtension'] &&
            this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr']
            ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr']
            : undefined;
    }

    getCadence(): number {
        return this.extensions &&
            this.extensions['gpxtpx:TrackPointExtension'] &&
            this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad']
            ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad']
            : undefined;
    }

    getPower(): number {
        return this.extensions &&
            this.extensions['gpxpx:PowerExtension'] &&
            this.extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']
            ? this.extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']
            : undefined;
    }

    setExtension(key: string, value: string) {
        if (!this.extensions) {
            this.extensions = {};
        }
        if (!this.extensions['gpxtpx:TrackPointExtension']) {
            this.extensions['gpxtpx:TrackPointExtension'] = {};
        }
        if (!this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']) {
            this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'] = {};
        }
        this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'][key] = value;
    }

    setExtensions(extensions: Record<string, string>) {
        Object.entries(extensions).forEach(([key, value]) => {
            this.setExtension(key, value);
        });
    }

    getExtensions(): Record<string, string> {
        return this.extensions &&
            this.extensions['gpxtpx:TrackPointExtension'] &&
            this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']
            ? this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']
            : emptyExtensions;
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
                ...trkpt,
                extensions: {
                    'gpxtpx:TrackPointExtension': {},
                    'gpxpx:PowerExtension': {},
                },
            };
            if (
                this.extensions['gpxtpx:TrackPointExtension'] &&
                this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] &&
                !exclude.includes('atemp')
            ) {
                trkpt.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'] =
                    this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp'];
            }
            if (
                this.extensions['gpxtpx:TrackPointExtension'] &&
                this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] &&
                !exclude.includes('hr')
            ) {
                trkpt.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'] =
                    this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'];
            }
            if (
                this.extensions['gpxtpx:TrackPointExtension'] &&
                this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] &&
                !exclude.includes('cad')
            ) {
                trkpt.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'] =
                    this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'];
            }
            if (
                this.extensions['gpxpx:PowerExtension'] &&
                this.extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts'] &&
                !exclude.includes('power')
            ) {
                trkpt.extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts'] =
                    this.extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts'];
            }
            if (
                this.extensions['gpxtpx:TrackPointExtension'] &&
                this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'] &&
                !exclude.includes('extensions')
            ) {
                trkpt.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'] = {};
                Object.entries(
                    this.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']
                ).forEach(([key, value]) => {
                    trkpt.extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'][key] =
                        value;
                });
            }
        }
        return trkpt;
    }

    clone(): TrackPoint {
        return new TrackPoint({
            attributes: {
                lat: this.attributes.lat,
                lon: this.attributes.lon,
            },
            ele: this.ele,
            time: this.time ? new Date(this.time.getTime()) : undefined,
            extensions: this.extensions ? cloneJSON(this.extensions) : undefined,
            _data: {
                index: this._data?.index,
                anchor: this._data?.anchor,
                zoom: this._data?.zoom,
            },
        });
    }
}

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

    constructor(waypoint: (WaypointType & { _data?: any }) | Waypoint, index?: number) {
        this.attributes = waypoint.attributes;
        this.ele = waypoint.ele;
        this.time = waypoint.time;
        this.name = waypoint.name === '' ? undefined : waypoint.name;
        this.cmt = waypoint.cmt === '' ? undefined : waypoint.cmt;
        this.desc = waypoint.desc === '' ? undefined : waypoint.desc;
        this.link =
            !waypoint.link ||
            !waypoint.link.attributes ||
            !waypoint.link.attributes.href ||
            waypoint.link.attributes.href === ''
                ? undefined
                : waypoint.link;
        this.sym = waypoint.sym === '' ? undefined : waypoint.sym;
        this.type = waypoint.type === '' ? undefined : waypoint.type;
        if (waypoint.hasOwnProperty('_data')) {
            this._data = waypoint._data;
        }
        if (index !== undefined) {
            this._data.index = index;
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
            };
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
            attributes: {
                lat: this.attributes.lat,
                lon: this.attributes.lon,
            },
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
        if (
            this.attributes.lat !== other.attributes.lat ||
            this.attributes.lon !== other.attributes.lon ||
            this.ele !== other.ele ||
            this.name !== other.name ||
            this.cmt !== other.cmt ||
            this.desc !== other.desc ||
            this.sym !== other.sym ||
            this.type !== other.type
        ) {
            return false;
        }

        if (
            (this.time === undefined && other.time !== undefined) ||
            (this.time !== undefined && other.time === undefined) ||
            (this.time !== undefined &&
                other.time !== undefined &&
                this.time.getTime() !== other.time.getTime())
        ) {
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

const earthRadius = 6371008.8;
export function distance(
    coord1: TrackPoint | Coordinates,
    coord2: TrackPoint | Coordinates
): number {
    if (coord1 instanceof TrackPoint) {
        coord1 = coord1.getCoordinates();
    }
    if (coord2 instanceof TrackPoint) {
        coord2 = coord2.getCoordinates();
    }
    const rad = Math.PI / 180;
    const lat1 = coord1.lat * rad;
    const lat2 = coord2.lat * rad;
    const dLat = lat2 - lat1;
    const dLon = (coord2.lon - coord1.lon) * rad;

    // Haversine formula - better numerical stability for small distances
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.sqrt(Math.min(a, 1)));
    return earthRadius * c;
}

export function getElevationDistanceFunction(statistics: GPXStatistics) {
    // x-coordinates are given by: statistics.local.distance.total[point._data.index] * 1000
    // y-coordinates are given by: point.ele
    // Compute the distance between point3 and the line defined by point1 and point2
    return (point1: TrackPoint, point2: TrackPoint, point3: TrackPoint) => {
        if (point1.ele === undefined || point2.ele === undefined || point3.ele === undefined) {
            return 0;
        }
        let x1 = statistics.local.data[point1._data.index].distance.total * 1000;
        let x2 = statistics.local.data[point2._data.index].distance.total * 1000;
        let x3 = statistics.local.data[point3._data.index].distance.total * 1000;
        let y1 = point1.ele;
        let y2 = point2.ele;
        let y3 = point3.ele;

        let dist = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
        if (dist === 0) {
            return Math.sqrt(Math.pow(x3 - x1, 2) + Math.pow(y3 - y1, 2));
        }

        return Math.abs((y2 - y1) * x3 - (x2 - x1) * y3 + x2 * y1 - y2 * x1) / dist;
    };
}

function windowSmoothing(
    left: number,
    right: number,
    distance: (index1: number, index2: number) => number,
    window: number,
    compute: (start: number, end: number) => number,
    callback: (value: number, index: number) => void
): void {
    let start = left;
    for (var i = left; i < right; i++) {
        while (start + 1 < i && distance(start, i) > window) {
            start++;
        }
        let end = Math.min(i + 2, right);
        while (end < right && distance(i, end) <= window) {
            end++;
        }
        callback(compute(start, end - 1), i);
    }
}

function distanceWindowSmoothing(
    left: number,
    right: number,
    statistics: GPXStatistics,
    window: number,
    compute: (start: number, end: number) => number,
    callback: (value: number, index: number) => void
): void {
    windowSmoothing(
        left,
        right,
        (index1, index2) =>
            statistics.local.data[index2].distance.total -
            statistics.local.data[index1].distance.total,
        window,
        compute,
        callback
    );
}

function timeWindowSmoothing(
    points: TrackPoint[],
    window: number,
    compute: (start: number, end: number) => number,
    callback: (value: number, index: number) => void
): void {
    windowSmoothing(
        0,
        points.length,
        (index1, index2) =>
            points[index2].time?.getTime() - points[index1].time?.getTime() || 2 * window,
        window,
        compute,
        callback
    );
}

function withTimestamps(
    points: TrackPoint[],
    speed: number,
    lastPoint: TrackPoint | undefined,
    startTime?: Date
): TrackPoint[] {
    let last = lastPoint;
    if (last === undefined) {
        last = points[0].clone();
        last.time = startTime;
    } else if (last.time === undefined) {
        last.time = startTime;
    }
    return points.map((point) => {
        let time = getTimestamp(last, point, speed);
        last = point.clone();
        last.time = time;
        return last;
    });
}

function withShiftedAndCompressedTimestamps(
    points: TrackPoint[],
    speed: number,
    ratio: number,
    lastPoint: TrackPoint
): TrackPoint[] {
    let start = getTimestamp(lastPoint, points[0], speed);
    let last = points[0];
    return points.map((point) => {
        let pt = point.clone();
        if (point.time === undefined) {
            pt.time = getTimestamp(last, point, speed);
        } else {
            pt.time = new Date(
                start.getTime() + ratio * (point.time.getTime() - points[0].time.getTime())
            );
        }
        last = pt;
        return pt;
    });
}

function withArtificialTimestamps(
    points: TrackPoint[],
    totalTime: number,
    lastPoint: TrackPoint | undefined,
    startTime: Date,
    statistics: GPXStatistics
): TrackPoint[] {
    const totalWeight = getArtificialTimestampWeight(points, statistics);

    let last = lastPoint;

    if (last === undefined) {
        last = points[0].clone();
        last.time = startTime;
    } else if (last.time === undefined) {
        last.time = startTime;
    }
    return points.map((point, i) => {
        let pt = point.clone();
        if (i === 0) {
            pt.time = lastPoint?.time ?? startTime;
        } else {
            const gapWeight =
                distance(points[i - 1].getCoordinates(), points[i].getCoordinates()) *
                (0.5 + 1 / (1 + Math.exp(-0.2 * statistics.local.data[i - 1].slope.at)));
            pt.time = new Date(
                last.time.getTime() +
                    (totalWeight > 0
                        ? (totalTime * 1000 * gapWeight) / totalWeight
                        : (totalTime * 1000) / Math.max(points.length - 1, 1))
            );
        }
        last = pt;
        return pt;
    });
}

export function getArtificialTimestampWeight(
    points: TrackPoint[],
    statistics: GPXStatistics
): number {
    let totalWeight = 0;
    for (let i = 0; i < points.length - 1; i++) {
        let dist = distance(points[i].getCoordinates(), points[i + 1].getCoordinates());
        totalWeight += dist * (0.5 + 1 / (1 + Math.exp(-0.2 * statistics.local.data[i].slope.at)));
    }
    return totalWeight;
}

export function getArtificialTimestampWeightForTrack(track: Track): number {
    return track.trkseg.reduce(
        (acc, segment) =>
            acc + getArtificialTimestampWeight(segment.getTrackPoints(), segment.getStatistics()),
        0
    );
}

export function getArtificialTimestampWeightForFile(file: GPXFile): number {
    return file.trk.reduce((acc, track) => acc + getArtificialTimestampWeightForTrack(track), 0);
}

export type ArtificialTimestampSelectionItem =
    | { kind: 'file' }
    | { kind: 'track'; trackIndex: number }
    | { kind: 'segment'; trackIndex: number; segmentIndex: number };

export type ArtificialTimestampSelectionGroup = {
    fileId: string;
    items: ArtificialTimestampSelectionItem[];
};

export function getArtificialTimestampWeightForSelection(
    file: GPXFile,
    items: ArtificialTimestampSelectionItem[]
): number {
    if (items.length === 0 || items.some((item) => item.kind === 'file')) {
        return getArtificialTimestampWeightForFile(file);
    }

    const trackItems = items.filter(
        (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'track' }> =>
            item.kind === 'track'
    );
    if (trackItems.length > 0) {
        return trackItems.reduce((acc, item) => {
            const track = file.trk[item.trackIndex];
            return track ? acc + getArtificialTimestampWeightForTrack(track) : acc;
        }, 0);
    }

    const segmentItems = items.filter(
        (item): item is Extract<ArtificialTimestampSelectionItem, { kind: 'segment' }> =>
            item.kind === 'segment'
    );
    return segmentItems.reduce((acc, item) => {
        const segment = file.trk[item.trackIndex]?.trkseg[item.segmentIndex];
        return segment
            ? acc + getArtificialTimestampWeight(segment.getTrackPoints(), segment.getStatistics())
            : acc;
    }, 0);
}

export function createArtificialTimestampsForSelection(
    files: Map<string, GPXFile>,
    startTime: Date,
    totalTime: number,
    groups: ArtificialTimestampSelectionGroup[]
): TrackPoint | undefined {
    // weight the ordered selection once at the file level, then let each file split internally
    const weightedGroups = groups.map((group) => {
        const file = files.get(group.fileId);
        return {
            group,
            file,
            weight: file ? getArtificialTimestampWeightForSelection(file, group.items) : 0,
        };
    });

    const totalWeight = weightedGroups.reduce((acc, entry) => acc + entry.weight, 0);
    const evenShare = weightedGroups.length > 0 ? totalTime / weightedGroups.length : totalTime;

    let lastPoint: TrackPoint | undefined = undefined;
    weightedGroups.forEach(({ group, file, weight }) => {
        if (!file) {
            return;
        }
        const allocatedTime = totalWeight > 0 ? (totalTime * weight) / totalWeight : evenShare;
        lastPoint = file.createArtificialTimestamps(
            startTime,
            allocatedTime,
            lastPoint,
            undefined,
            undefined,
            group.items
        );
    });
    return lastPoint;
}

function getTimestamp(a: TrackPoint, b: TrackPoint, speed: number): Date {
    if (a.time === undefined) {
        return undefined;
    } else if (speed === undefined) {
        return new Date(a.time.getTime() + 1000);
    }
    let dist = distance(a.getCoordinates(), b.getCoordinates()) / 1000;
    return new Date(a.time.getTime() + (1000 * 3600 * dist) / speed);
}

function getOriginal(obj: any): any {
    while (isDraft(obj)) {
        obj = original(obj);
    }
    return obj;
}

export type MergedLineStyles = {
    color: string[];
    opacity: number[];
    width: number[];
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
            if (
                rpt.extensions &&
                rpt.extensions['gpxx:RoutePointExtension'] &&
                rpt.extensions['gpxx:RoutePointExtension']['gpxx:rpt']
            ) {
                rpt.extensions['gpxx:RoutePointExtension']['gpxx:rpt'].forEach((rptExtension) => {
                    segment.trkpt.push(
                        new TrackPoint({
                            attributes: rptExtension.attributes,
                        })
                    );
                });
            } else {
                segment.trkpt.push(
                    new TrackPoint({
                        attributes: rpt.attributes,
                        ele: rpt.ele,
                        time: rpt.time,
                    })
                );
            }
        });

        track.trkseg.push(segment);
    }

    return track;
}
