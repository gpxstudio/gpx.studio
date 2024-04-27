export type GPXFileType = {
    attributes: GPXFileAttributes;
    metadata: Metadata;
    wpt: WaypointType[];
    trk: TrackType[];
};

export type GPXFileAttributes = {
    creator?: string;
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

export type WaypointType = {
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

export type TrackType = {
    name?: string;
    cmt?: string;
    desc?: string;
    src?: string;
    link?: Link;
    type?: string;
    trkseg: TrackSegmentType[];
    extensions?: TrackExtensions;
};

export type TrackExtensions = {
    'gpx_style:line'?: LineStyleExtension;
};

export type LineStyleExtension = {
    color?: string;
    opacity?: number;
    weight?: number;
};

export type TrackSegmentType = {
    trkpt: TrackPointType[];
};

export type TrackPointType = {
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