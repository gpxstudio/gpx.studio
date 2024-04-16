import { GPXFileAttributes, GPXFileType, Link, Metadata, TrackExtensions, TrackPoint, TrackSegmentType, TrackType, Waypoint } from "./types";

export class GPXFile {
    attributes: GPXFileAttributes;
    metadata: Metadata;
    wpt: Waypoint[];
    trk: Track[];

    constructor(gpx: GPXFileType | GPXFile) {
        this.attributes = gpx.attributes;
        this.metadata = gpx.metadata;
        this.wpt = gpx.wpt;
        this.trk = gpx.trk.map((track) => new Track(track));
    }

    reverse(): void {
        for (let i = 0; i < this.trk.length; i++) {
            this.trk[i].reverse();
        }
        this.trk.reverse();
    }

    clone(): GPXFile {
        return new GPXFile(structuredClone(this));
    }
};

export class Track {
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    trkseg: TrackSegment[];
    extensions?: TrackExtensions;

    constructor(track: TrackType) {
        this.name = track.name;
        this.cmt = track.cmt;
        this.desc = track.desc;
        this.src = track.src;
        this.link = track.link;
        this.type = track.type;
        this.trkseg = track.trkseg.map((seg) => new TrackSegment(seg));
        this.extensions = track.extensions;
    }

    reverse(): void {
        for (let i = 0; i < this.trkseg.length; i++) {
            this.trkseg[i].reverse();
        }
        this.trkseg.reverse();
    }
};


export class TrackSegment {
    trkpt: TrackPoint[];

    constructor(segment: TrackSegmentType) {
        this.trkpt = segment.trkpt;
    }

    reverse(): void {
        this.trkpt.reverse();
    }
};