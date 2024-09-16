import { TrackPoint } from "./gpx";
import { Coordinates } from "./types";
export type SimplifiedTrackPoint = {
    point: TrackPoint;
    distance?: number;
};
export declare function ramerDouglasPeucker(points: TrackPoint[], epsilon?: number, measure?: (a: TrackPoint, b: TrackPoint, c: TrackPoint) => number): SimplifiedTrackPoint[];
export declare function crossarcDistance(point1: TrackPoint, point2: TrackPoint, point3: TrackPoint | Coordinates): number;
export declare function projectedPoint(point1: TrackPoint, point2: TrackPoint, point3: TrackPoint | Coordinates): Coordinates;
