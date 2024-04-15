import { XMLParser } from "fast-xml-parser";
import { Author, GPXFile, Link, Metadata, Track, TrackPoint, TrackSegment, Waypoint } from "./types";

const arrayTypes = ['trk', 'trkseg', 'trkpt', 'wpt'];

export function parseGPX(gpxData: string): GPXFile {
    const parser = new XMLParser({
        isArray: (name: string) => arrayTypes.includes(name),
        ignoreAttributes: false,
        attributeNamePrefix: "",
    });
    const parsed = parser.parse(gpxData);

    const result: GPXFile = {
        creator: parsed.gpx.creator ? parsed.gpx.creator : "",
        metadata: parseMetadata(parsed.gpx.metadata),
        waypoints: parsed.gpx.wpt ? parsed.gpx.wpt.map(parseWaypoint) : [],
        tracks: parsed.gpx.trk ? parsed.gpx.trk.map(parseTrack) : [],
    };

    return result;
}

function parseMetadata(metadata: any): Metadata {
    const result: Metadata = {};

    if (metadata.name) {
        result.name = metadata.name;
    }

    if (metadata.desc) {
        result.desc = metadata.desc;
    }

    if (metadata.author) {
        result.author = parseAuthor(metadata.author);
    }

    if (metadata.link) {
        result.link = parseLink(metadata.link);
    }

    if (metadata.time) {
        result.time = new Date(metadata.time);
    }

    return result;
}

function parseAuthor(author: any): Author {
    const result: Author = {};

    if (author.name) {
        result.name = author.name;
    }

    if (author.email) {
        result.email = author.email;
    }

    if (author.link) {
        result.link = parseLink(author.link);
    }

    return result;
}

function parseLink(link: any): Link {
    const result: Link = {
        href: link.href,
    };

    if (link.text) {
        result.text = link.text;
    }

    if (link.type) {
        result.type = link.type;
    }

    return result;
}

function parseWaypoint(waypoint: any): Waypoint {
    const result: Waypoint = {
        lat: waypoint.lat,
        lon: waypoint.lon,
    };

    if (waypoint.ele) {
        result.ele = waypoint.ele;
    }

    if (waypoint.time) {
        result.time = new Date(waypoint.time);
    }

    if (waypoint.name) {
        result.name = waypoint.name;
    }

    if (waypoint.cmt) {
        result.cmt = waypoint.cmt;
    }

    if (waypoint.desc) {
        result.desc = waypoint.desc;
    }

    if (waypoint.link) {
        result.link = parseLink(waypoint.link);
    }

    if (waypoint.sym) {
        result.sym = waypoint.sym;
    }

    if (waypoint.type) {
        result.type = waypoint.type;
    }

    return result;
}

function parseTrack(track: any): Track {
    const result: Track = {
        trkseg: track.trkseg.map(parseTrackSegment),
    };

    if (track.name) {
        result.name = track.name;
    }

    if (track.cmt) {
        result.cmt = track.cmt;
    }

    if (track.desc) {
        result.desc = track.desc;
    }

    if (track.src) {
        result.src = track.src;
    }

    if (track.link) {
        result.link = parseLink(track.link);
    }

    if (track.type) {
        result.type = track.type;
    }

    return result;
}

function parseTrackSegment(segment: any): TrackSegment {
    return {
        trkpt: segment.trkpt.map(parseTrackPoint),
    };
}

function parseTrackPoint(point: any): TrackPoint {
    const result: TrackPoint = {
        lat: point.lat,
        lon: point.lon,
    };

    if (point.ele) {
        result.ele = point.ele;
    }

    if (point.time) {
        result.time = new Date(point.time);
    }

    return result;
}

import * as fs from 'fs';

console.log(parseGPX(fs.readFileSync("test-data/simple.gpx", 'utf8')));