import { GPXFileType, TrackSegmentType, TrackType } from "./types";

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

export type GPXFileAttributes = {
    creator: string;
    [key: string]: string;
};

export type Metadata = {
    name?: string;
    desc?: string;
    author?: Author;
    link?: Link;
    time?: Date;
};

export type Link = {
    attributes: LinkAttributes;
    text?: string;
    type?: string;
};

export type LinkAttributes = {
    href: string;
};

export type Waypoint = {
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    name?: string;
    cmt?: string;
    desc?: string;
    link?: Link;
    sym?: string;
    type?: string;
};

export type Coordinates = {
    lat: number;
    lon: number;
};

export type TrackExtensions = {
    'gpx_style:line'?: LineStyleExtension;
};

export type LineStyleExtension = {
    color?: string;
    opacity?: number;
    weight?: number;
};

export type TrackPoint = {
    attributes: Coordinates;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;
};

export type TrackPointExtensions = {
    'gpxtpx:TrackPointExtension'?: TrackPointExtension;
    'gpxpx:PowerExtension'?: PowerExtension;
};

export type TrackPointExtension = {
    'gpxtpx:hr'?: number;
    'gpxtpx:cad'?: number;
    'gpxtpx:atemp'?: number;
    'gpxtpx:Extensions'?: {
        surface?: string;
    };
}

export type PowerExtension = {
    'gpxpx:PowerInWatts'?: number;
}

export type Author = {
    name?: string;
    email?: string;
    link?: Link;
};