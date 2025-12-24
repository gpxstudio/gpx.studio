import { TrackPoint } from './gpx';
import { Coordinates } from './types';

export type SimplifiedTrackPoint = { point: TrackPoint; distance?: number };

export function ramerDouglasPeucker(
    points: TrackPoint[],
    epsilon: number = 50,
    measure: (a: TrackPoint, b: TrackPoint, c: TrackPoint) => number = crossarcDistance
): SimplifiedTrackPoint[] {
    if (points.length == 0) {
        return [];
    } else if (points.length == 1) {
        return [
            {
                point: points[0],
            },
        ];
    }

    let simplified = [
        {
            point: points[0],
        },
    ];
    ramerDouglasPeuckerRecursive(points, epsilon, measure, 0, points.length - 1, simplified);
    simplified.push({
        point: points[points.length - 1],
    });
    return simplified;
}

function ramerDouglasPeuckerRecursive(
    points: TrackPoint[],
    epsilon: number,
    measure: (a: TrackPoint, b: TrackPoint, c: TrackPoint) => number,
    start: number,
    end: number,
    simplified: SimplifiedTrackPoint[]
) {
    let largest = {
        index: 0,
        distance: 0,
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

export function crossarcDistance(
    point1: TrackPoint | Coordinates,
    point2: TrackPoint | Coordinates,
    point3: TrackPoint | Coordinates
): number {
    return crossarc(
        point1 instanceof TrackPoint ? point1.getCoordinates() : point1,
        point2 instanceof TrackPoint ? point2.getCoordinates() : point2,
        point3 instanceof TrackPoint ? point3.getCoordinates() : point3
    );
}

const metersPerLatitudeDegree = 111320;

function getMetersPerLongitudeDegree(latitude: number): number {
    return Math.cos((latitude * Math.PI) / 180) * metersPerLatitudeDegree;
}

function crossarc(coord1: Coordinates, coord2: Coordinates, coord3: Coordinates): number {
    // Calculates the perpendicular distance in meters
    // between a line segment (defined by p1 and p2) and a third point, p3.
    // Uses simple planar geometry (ignores earth curvature).

    // Convert to meters using approximate scaling
    const metersPerLongitudeDegree = getMetersPerLongitudeDegree(coord1.lat);

    const x1 = coord1.lon * metersPerLongitudeDegree;
    const y1 = coord1.lat * metersPerLatitudeDegree;
    const x2 = coord2.lon * metersPerLongitudeDegree;
    const y2 = coord2.lat * metersPerLatitudeDegree;
    const x3 = coord3.lon * metersPerLongitudeDegree;
    const y3 = coord3.lat * metersPerLatitudeDegree;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segmentLengthSquared = dx * dx + dy * dy;

    if (segmentLengthSquared === 0) {
        // p1 and p2 are the same point
        return Math.sqrt((x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1));
    }

    // Project p3 onto the line defined by p1-p2
    const t = Math.max(0, Math.min(1, ((x3 - x1) * dx + (y3 - y1) * dy) / segmentLengthSquared));

    // Find the closest point on the segment
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    // Return distance from p3 to the projected point
    return Math.sqrt((x3 - projX) * (x3 - projX) + (y3 - projY) * (y3 - projY));
}

export function projectedPoint(
    point1: TrackPoint,
    point2: TrackPoint,
    point3: TrackPoint | Coordinates
): Coordinates {
    return projected(
        point1.getCoordinates(),
        point2.getCoordinates(),
        point3 instanceof TrackPoint ? point3.getCoordinates() : point3
    );
}

function projected(coord1: Coordinates, coord2: Coordinates, coord3: Coordinates): Coordinates {
    // Calculates the point on the line segment defined by p1 and p2
    // that is closest to the third point, p3.
    // Uses simple planar geometry (ignores earth curvature).

    // Convert to meters using approximate scaling
    const metersPerLongitudeDegree = getMetersPerLongitudeDegree(coord1.lat);

    const x1 = coord1.lon * metersPerLongitudeDegree;
    const y1 = coord1.lat * metersPerLatitudeDegree;
    const x2 = coord2.lon * metersPerLongitudeDegree;
    const y2 = coord2.lat * metersPerLatitudeDegree;
    const x3 = coord3.lon * metersPerLongitudeDegree;
    const y3 = coord3.lat * metersPerLatitudeDegree;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segmentLengthSquared = dx * dx + dy * dy;

    if (segmentLengthSquared === 0) {
        // p1 and p2 are the same point
        return coord1;
    }

    // Project p3 onto the line defined by p1-p2
    const t = Math.max(0, Math.min(1, ((x3 - x1) * dx + (y3 - y1) * dy) / segmentLengthSquared));

    // Find the closest point on the segment
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    // Convert back to degrees
    return {
        lat: projY / metersPerLatitudeDegree,
        lon: projX / metersPerLongitudeDegree,
    };
}
