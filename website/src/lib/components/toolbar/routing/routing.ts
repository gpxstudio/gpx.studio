import type { Coordinates, GPXFile, TrackPoint } from "gpx";
import mapboxgl from "mapbox-gl";

export function getMarker(coordinates: Coordinates, draggable: boolean = false): mapboxgl.Marker {
    let element = document.createElement('div');
    element.className = `h-3 w-3 rounded-full bg-background border-2 border-black cursor-pointer`;
    return new mapboxgl.Marker({
        draggable,
        element
    }).setLngLat(coordinates);
}

export type SimplifiedTrackPoint = { point: TrackPoint, index: number, distance?: number, segment?: number, zoom?: number };

export class AnchorPointHierarchy {
    points: SimplifiedTrackPoint[][];

    constructor() {
        this.points = [];
        for (let i = 0; i <= 20; i++) {
            this.points.push([]);
        }
    }

    getMarkers(): mapboxgl.Marker[] {
        let markers = [];
        for (let points of this.points) {
            for (let point of points) {
                let marker = getMarker(point.point.getCoordinates(), true);
                Object.defineProperty(marker, '_simplified', { value: point });
                markers.push(marker);
            }
        }
        return markers;
    }

    static create(file: GPXFile, epsilon: number = 50): AnchorPointHierarchy {
        let hierarchy = new AnchorPointHierarchy();

        let s = 0;
        for (let track of file.getChildren()) {
            for (let segment of track.getChildren()) {
                let points = segment.trkpt;
                let simplified = ramerDouglasPeucker(points, epsilon);
                // Assign segment number to each point
                simplified.forEach((point) => {
                    point.segment = s;
                    point.zoom = getZoomLevelForDistance(point.point.getLatitude(), point.distance);
                    hierarchy.points[point.zoom].push(point);
                });
                s++;
            }
        }

        return hierarchy;
    }
}

function getZoomLevelForDistance(latitude: number, distance?: number): number {
    if (distance === undefined) {
        return 0;
    }

    const rad = Math.PI / 180;
    const lat = latitude * rad;

    return Math.min(20, Math.max(0, Math.floor(Math.log2((earthRadius * Math.cos(lat)) / distance))));
}

function ramerDouglasPeucker(points: TrackPoint[], epsilon: number, start: number = 0, end: number = points.length - 1): SimplifiedTrackPoint[] {
    let simplified = [{
        point: points[start],
        index: start,

    }];
    ramerDouglasPeuckerRecursive(points, epsilon, start, end, simplified);
    simplified.push({
        point: points[end],
        index: end
    });
    return simplified;
}

function ramerDouglasPeuckerRecursive(points: TrackPoint[], epsilon: number, start: number, end: number, simplified: SimplifiedTrackPoint[]) {
    let largest = {
        index: 0,
        distance: 0
    };

    for (let i = start + 1; i < end; i++) {
        let distance = crossarc(points[start].getCoordinates(), points[end].getCoordinates(), points[i].getCoordinates());
        if (distance > largest.distance) {
            largest.index = i;
            largest.distance = distance;
        }
    }

    if (largest.distance > epsilon) {
        ramerDouglasPeuckerRecursive(points, epsilon, start, largest.index, simplified);
        simplified.push({ point: points[largest.index], index: largest.index, distance: largest.distance });
        ramerDouglasPeuckerRecursive(points, epsilon, largest.index, end, simplified);
    }
}

const earthRadius = 6371008.8;

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

export function route(points: TrackPoint[], brouterProfile: string, privateRoads: boolean, routing: boolean) {
    if (routing) {
        getRoute(points, brouterProfile, privateRoads).then(response => {
            return response.json();
        });
    } else {
        return new Promise((resolve) => {
            resolve(points);
        });
    }
}

function getRoute(points: TrackPoint[], brouterProfile: string, privateRoads: boolean): Promise<Response> {
    let url = `https://routing.gpx.studio?profile=${brouterProfile + privateRoads ? '-private' : ''}&lonlats=${points.map(point => `${point.getLongitude()},${point.getLatitude()}`).join('|')}&format=geojson&alternativeidx=0`;
    return fetch(url);
}