import { earthRadius, ramerDouglasPeucker } from "$lib/simplify";
import type { GPXFile, TrackSegment } from "gpx";

export function getZoomLevelForDistance(latitude: number, distance?: number): number {
    if (distance === undefined) {
        return 0;
    }

    const rad = Math.PI / 180;
    const lat = latitude * rad;

    return Math.min(20, Math.max(0, Math.floor(Math.log2((earthRadius * Math.cos(lat)) / distance))));
}

export function updateAnchorPoints(file: GPXFile) {
    let segments = file.getSegments();

    for (let segment of segments) {
        if (!segment._data.anchors) { // New segment, compute anchor points for it
            computeAnchorPoints(segment);
            continue;
        }

        if (segment.trkpt.length > 0) {
            if (!segment.trkpt[0]._data.anchor) { // First point is not an anchor, make it one
                segment.trkpt[0]._data.anchor = true;
                segment.trkpt[0]._data.zoom = 0;
            }

            if (!segment.trkpt[segment.trkpt.length - 1]._data.anchor) { // Last point is not an anchor, make it one
                segment.trkpt[segment.trkpt.length - 1]._data.anchor = true;
                segment.trkpt[segment.trkpt.length - 1]._data.zoom = 0;
            }
        }
    }
}

function computeAnchorPoints(segment: TrackSegment) {
    let points = segment.trkpt;
    let anchors = ramerDouglasPeucker(points);
    anchors.forEach((anchor) => {
        let point = anchor.point;
        point._data.anchor = true;
        point._data.zoom = getZoomLevelForDistance(point.getLatitude(), anchor.distance);
    });
    segment._data.anchors = true;
}

