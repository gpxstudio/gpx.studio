export type GPXFile = {
    creator: string;
    metadata: Metadata;
    wpt: Waypoint[];
    trk: Track[];
};

export type Metadata = {
    name?: string;
    desc?: string;
    author?: Author;
    link?: Link;
    time?: Date;
};

export type Link = {
    href: string;
    text?: string;
    type?: string;
};

export type Waypoint = {
    lat: number;
    lon: number;
    ele?: number;
    time?: Date;
    name?: string;
    cmt?: string;
    desc?: string;
    link?: Link;
    sym?: string;
    type?: string;
};

export type Track = {
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    trkseg: TrackSegment[];
    extensions?: TrackExtensions;
};

export type TrackExtensions = {
    line?: LineStyleExtension;
};

export type LineStyleExtension = {
    color?: string;
    opacity?: number;
    weight?: number;
};

export type TrackSegment = {
    trkpt: TrackPoint[];
};

export type TrackPoint = {
    lat: number;
    lon: number;
    ele?: number;
    time?: Date;
    extensions?: TrackPointExtensions;
};

export type TrackPointExtensions = {
    TrackPointExtension?: TrackPointExtension;
    PowerExtension?: PowerExtension;
};

export type TrackPointExtension = {
    hr?: number;
    cad?: number;
    atemp?: number;
    Extensions?: {
        surface?: string;
    };
}

export type PowerExtension = {
    PowerInWatts?: number;
}

export type Author = {
    name?: string;
    email?: string;
    link?: Link;
};