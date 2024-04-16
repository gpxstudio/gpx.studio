export type GPXFile = {
    creator: string;
    metadata: Metadata;
    waypoints: Waypoint[];
    tracks: Track[];
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
    style?: TrackStyleExtension;
};

export type TrackStyleExtension = {
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
    hr?: number;
    cad?: number;
    atemp?: number;
    power?: number;
    surface?: string;
};

export type Author = {
    name?: string;
    email?: string;
    link?: Link;
};