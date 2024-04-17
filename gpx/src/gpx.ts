import { Coordinates, GPXFileAttributes, GPXFileType, Link, Metadata, TrackExtensions, TrackPointExtensions, TrackPointType, TrackSegmentType, TrackType, Waypoint } from "./types";

// An abstract class that groups functions that need to be computed recursively in the GPX file hierarchy
abstract class GPXTreeElement<T extends GPXTreeElement<any>> {

    abstract isLeaf(): boolean;
    abstract getChildren(): T[];

    abstract reverse(originalNextTimestamp?: Date, newPreviousTimestamp?: Date): void;

    abstract getStartTimestamp(): Date;
    abstract getEndTimestamp(): Date;

    abstract toGeoJSON(): any;
}

// An abstract class that can be extended to facilitate functions working similarly with Tracks and TrackSegments
abstract class GPXTreeNode<T extends GPXTreeElement<any>> extends GPXTreeElement<T> {
    isLeaf(): boolean {
        return false;
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
        this.attributes = gpx.attributes;
        this.metadata = gpx.metadata;
        this.wpt = gpx.wpt;
        this.trk = gpx.trk.map((track) => new Track(track));
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
        this.link = track.link;
        this.type = track.type;
        this.trkseg = track.trkseg.map((seg) => new TrackSegment(seg));
        this.extensions = track.extensions;
    }

    getChildren(): TrackSegment[] {
        return this.trkseg;
    }

    clone(): Track {
        return new Track(structuredClone(this));
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
};

// A class that represents a TrackSegment in a GPX file
export class TrackSegment extends GPXTreeLeaf {
    trkpt: TrackPoint[];

    constructor(segment: TrackSegmentType | TrackSegment) {
        super();
        this.trkpt = segment.trkpt.map((point) => new TrackPoint(point));
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
        this.attributes = point.attributes;
        this.ele = point.ele;
        if (point.time) {
            this.time = new Date(point.time.getTime());
        }
        this.extensions = point.extensions;
    }
};