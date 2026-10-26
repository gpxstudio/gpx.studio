import type { Feature, LineString } from 'geojson';
import { normalizeColor, type FileColorAllocator } from '$lib/engine/file-colors';
import type { Visibility } from '$lib/engine/file-visibility';
import type { Backend } from './backend';
import { toPositions } from './convert';
import {
    EMPTY_STATISTICS,
    type FileState,
    type PathInfo,
    type SegmentNode,
    type SegmentProperties,
} from './types';

/** Reads the state of a file, reusing from `previous` what did not change. */
export async function readFileState(
    backend: Backend,
    id: string,
    colors: FileColorAllocator,
    visibility: ReadonlyMap<string, Visibility>,
    previous?: FileState
): Promise<FileState | null> {
    const structure = await backend.file_structure(id);
    if (!structure) {
        return null;
    }

    const paths: PathInfo[] = [...structure.routes, ...structure.tracks];
    const color = colors.resolve(
        id,
        paths.map((path) => path.color)
    );

    const previousSegments = new Map(
        previous?.segments.features.map((f) => [f.properties.segmentId, f]) ?? []
    );
    // the coordinates of the segments that changed, read together
    const segments: (
        | Feature<LineString, SegmentProperties>
        | Promise<Feature<LineString, SegmentProperties>>
    )[] = [];
    const addSegment = (
        segment: SegmentNode,
        path: PathInfo,
        parent: Pick<SegmentProperties, 'routeId' | 'trackId'>
    ) => {
        const properties: SegmentProperties = {
            fileId: id,
            ...parent,
            segmentId: segment.id,
            rev: segment.rev,
            color: path.color !== undefined ? normalizeColor(path.color) : color,
            opacity: path.opacity,
            width: path.width,
        };
        const old = previousSegments.get(segment.id);
        const unchanged =
            old !== undefined &&
            (Object.keys(properties) as (keyof SegmentProperties)[]).every(
                (key) => old.properties[key] === properties[key]
            );
        segments.push(
            unchanged
                ? old
                : backend.segment_coordinates(segment.id).then((coordinates) => ({
                      type: 'Feature',
                      geometry: {
                          type: 'LineString',
                          coordinates: toPositions(coordinates),
                      },
                      properties,
                  }))
        );
    };
    structure.routes.forEach((route) => addSegment(route.segment, route, { routeId: route.id }));
    structure.tracks.forEach((track) => {
        track.segments.forEach((segment) => addSegment(segment, track, { trackId: track.id }));
    });
    const segmentFeatures = await Promise.all(segments);

    const previousStructure = previous?.structure;
    const waypointsUnchanged =
        previousStructure !== undefined &&
        previousStructure.waypointsRev === structure.waypointsRev &&
        previousStructure.waypoints.length === structure.waypoints.length &&
        previousStructure.waypoints.every(
            (w, i) =>
                w.id === structure.waypoints[i].id &&
                w.name === structure.waypoints[i].name &&
                w.sym === structure.waypoints[i].sym
        );
    let waypoints = previous?.waypoints;
    if (!waypoints || !waypointsUnchanged) {
        const coordinates = toPositions(await backend.waypoint_coordinates(id));
        waypoints = {
            type: 'FeatureCollection',
            features: structure.waypoints.map((waypoint, index) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: coordinates[index] },
                properties: {
                    fileId: id,
                    waypointId: waypoint.id,
                    index,
                    name: waypoint.name,
                    sym: waypoint.sym,
                },
            })),
        };
    }

    return {
        structure,
        color,
        statistics: (await backend.file_statistics(id)) ?? EMPTY_STATISTICS,
        segments: { type: 'FeatureCollection', features: segmentFeatures },
        waypoints,
        visibility: visibility.get(id) ?? new Map(),
    };
}
