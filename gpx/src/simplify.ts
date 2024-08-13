import { TrackPoint } from "./gpx";
import { Coordinates } from "./types";

export type SimplifiedTrackPoint = { point: TrackPoint, distance?: number };

const earthRadius = 6371008.8;

export function ramerDouglasPeucker(points: TrackPoint[], epsilon: number = 50, measure: (a: TrackPoint, b: TrackPoint, c: TrackPoint) => number = crossarcDistance): SimplifiedTrackPoint[] {
    if (points.length == 0) {
        return [];
    } else if (points.length == 1) {
        return [{
            point: points[0]
        }];
    }

    let simplified = [{
        point: points[0]
    }];
    ramerDouglasPeuckerRecursive(points, epsilon, measure, 0, points.length - 1, simplified);
    simplified.push({
        point: points[points.length - 1]
    });
    return simplified;
}

function ramerDouglasPeuckerRecursive(points: TrackPoint[], epsilon: number, measure: (a: TrackPoint, b: TrackPoint, c: TrackPoint) => number, start: number, end: number, simplified: SimplifiedTrackPoint[]) {
    let largest = {
        index: 0,
        distance: 0
    };

    for (let i = start + 1; i < end; i++) {
        let distance = measure(points[start], points[end], points[i]);
        if (distance > largest.distance) {
            largest.index = i;
            largest.distance = distance;
        }
    }

    if (largest.distance > epsilon && largest.index != 0) {
        ramerDouglasPeuckerRecursive(points, epsilon, measure, start, largest.index, simplified);
        simplified.push({ point: points[largest.index], distance: largest.distance });
        ramerDouglasPeuckerRecursive(points, epsilon, measure, largest.index, end, simplified);
    }
}

export function crossarcDistance(point1: TrackPoint, point2: TrackPoint, point3: TrackPoint | Coordinates): number {
    return crossarc(point1.getCoordinates(), point2.getCoordinates(), point3 instanceof TrackPoint ? point3.getCoordinates() : point3);
}

function crossarc(coord1: Coordinates, coord2: Coordinates, coord3: Coordinates): number {
    // Calculates the shortest distance in meters 
    // between an arc (defined by p1 and p2) and a third point, p3.
    // Input lat1,lon1,lat2,lon2,lat3,lon3 in degrees.

    const rad = Math.PI / 180;
    const lat1 = coord1.lat * rad;
    const lat2 = coord2.lat * rad;
    const lat3 = coord3.lat * rad;

    const lon1 = coord1.lon * rad;
    const lon2 = coord2.lon * rad;
    const lon3 = coord3.lon * rad;

    // Prerequisites for the formulas
    const bear12 = bearing(lat1, lon1, lat2, lon2);
    const bear13 = bearing(lat1, lon1, lat3, lon3);
    let dis13 = distance(lat1, lon1, lat3, lon3);

    let diff = Math.abs(bear13 - bear12);
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }

    // Is relative bearing obtuse?
    if (diff > (Math.PI / 2)) {
        return dis13;
    }

    // Find the cross-track distance.
    let dxt = Math.asin(Math.sin(dis13 / earthRadius) * Math.sin(bear13 - bear12)) * earthRadius;

    // Is p4 beyond the arc?
    let dis12 = distance(lat1, lon1, lat2, lon2);
    let dis14 = Math.acos(Math.cos(dis13 / earthRadius) / Math.cos(dxt / earthRadius)) * earthRadius;
    if (dis14 > dis12) {
        return distance(lat2, lon2, lat3, lon3);
    } else {
        return Math.abs(dxt);
    }
}

function distance(latA: number, lonA: number, latB: number, lonB: number): number {
    // Finds the distance between two lat / lon points.
    return Math.acos(Math.sin(latA) * Math.sin(latB) + Math.cos(latA) * Math.cos(latB) * Math.cos(lonB - lonA)) * earthRadius;
}


function bearing(latA: number, lonA: number, latB: number, lonB: number): number {
    // Finds the bearing from one lat / lon point to another.
    return Math.atan2(Math.sin(lonB - lonA) * Math.cos(latB),
        Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(lonB - lonA));
}