import type { Coordinates, GPXFile, TrackPoint } from "gpx";
import mapboxgl from "mapbox-gl";

export type TrackPointWithIndex = { point: TrackPoint, index: number };

export class AnchorPointHierarchy {
    level: number;
    lowestLevel: number;
    point: TrackPointWithIndex | null;
    left: AnchorPointHierarchy[] | null = null;
    right: AnchorPointHierarchy[] | null = null;
    leftParent: AnchorPointHierarchy | null = null;
    rightParent: AnchorPointHierarchy | null = null;

    constructor(level: number, point: TrackPointWithIndex | null) {
        this.level = level;
        this.lowestLevel = level;
        this.point = point;
    }

    getMarkers(map: mapboxgl.Map, last: boolean = true, markers: mapboxgl.Marker[] = []): mapboxgl.Marker[] {
        if (this.left == null && this.right == null && this.point) {
            let element = document.createElement('div');
            element.className = 'hidden h-3 w-3 rounded-full bg-background border-2 border-black';
            let marker = new mapboxgl.Marker({
                draggable: true,
                element
            });
            marker.setLngLat(this.point.point.getCoordinates());
            marker.addTo(map);
            Object.defineProperty(marker, '_hierarchy', { value: this });
            markers.push(marker);
        }

        if (this.right) {
            this.right.forEach((point, index) => {
                if ((index < this.right.length - 1) || last) {
                    // (index >= this.right.length - 2) because the last point must be drawn by the second to last AnchorPointHierarchy
                    // because only the right children are drawn
                    point.getMarkers(map, (index >= this.right.length - 2) && last, markers);
                }
            });
        }

        return markers;
    }

    static create(file: GPXFile, initialEpsilon: number = 50000, minEpsilon: number = 50): AnchorPointHierarchy {
        let hierarchies = [];
        for (let track of file.getChildren()) {
            for (let segment of track.getChildren()) {
                let points = segment.trkpt;
                let hierarchy = new AnchorPointHierarchy(0, null);
                hierarchy.right = AnchorPointHierarchy.createRecursive(1, 1, 1, points, initialEpsilon, minEpsilon);
                hierarchies.push(hierarchy);
            }
        }
        let hierarchy = new AnchorPointHierarchy(0, null);
        hierarchy.right = hierarchies;
        return hierarchy;
    }

    static createRecursive(level: number, levelLeft: number, levelRight: number, points: TrackPoint[], epsilon: number, minEpsilon: number, start: number = 0, end: number = points.length - 1): AnchorPointHierarchy[] {
        if (start == end) {
            return [new AnchorPointHierarchy(Math.min(levelLeft, levelRight), { point: points[start], index: start })];
        } else if (epsilon < minEpsilon || end - start == 1) {
            return [new AnchorPointHierarchy(levelLeft, { point: points[start], index: start }), new AnchorPointHierarchy(levelRight, { point: points[end], index: end })];
        }

        let simplified = ramerDouglasPeucker(points, epsilon, start, end);

        let hierarchy = [];
        for (let i = 0; i < simplified.length; i++) {
            hierarchy.push(new AnchorPointHierarchy(
                i == 0 ? levelLeft : i == simplified.length - 1 ? levelRight : level,
                simplified[i]
            ));
        }

        let childHierarchies = [];

        for (let i = 0; i < simplified.length - 1; i++) {
            childHierarchies.push(AnchorPointHierarchy.createRecursive(level + 1, i == 0 ? levelLeft : level, i == simplified.length - 2 ? levelRight : level, points, epsilon / 1.54, minEpsilon, simplified[i].index, simplified[i + 1].index));

            hierarchy[i].right = childHierarchies[i];
            hierarchy[i + 1].left = childHierarchies[i];
        }

        return hierarchy;
    }
}

function ramerDouglasPeucker(points: TrackPoint[], epsilon: number, start: number = 0, end: number = points.length - 1): TrackPointWithIndex[] {
    let simplified = [{
        point: points[start],
        index: start
    }];
    ramerDouglasPeuckerRecursive(points, epsilon, start, end, simplified);
    simplified.push({
        point: points[end],
        index: end
    });
    return simplified;
}

function ramerDouglasPeuckerRecursive(points: TrackPoint[], epsilon: number, start: number, end: number, simplified: TrackPointWithIndex[]) {
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
        simplified.push({ point: points[largest.index], index: largest.index });
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

