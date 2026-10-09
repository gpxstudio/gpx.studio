import type { Feature, LineString } from 'geojson';
import { normalizeColor, type FileColorAllocator } from '$lib/file-colors';
import type { Visibility } from '$lib/file-visibility';
import { toPositions, type Wasm } from './convert';
import { EMPTY_STATISTICS, type FileState, type SegmentProperties } from './types';

/** Reads the state of a file, reusing from `previous` what did not change. */
export function readFileState(
    wasm: Wasm,
    id: string,
    colors: FileColorAllocator,
    visibility: ReadonlyMap<string, Visibility>,
    previous?: FileState
): FileState | null {
    const structure = wasm.file_structure(id);
    if (!structure) {
        return null;
    }

    const color = colors.resolve(
        id,
        structure.tracks.map((track) => track.color)
    );

    const previousSegments = new Map(
        previous?.segments.features.map((f) => [f.properties.segmentId, f]) ?? []
    );
    const segments: Feature<LineString, SegmentProperties>[] = [];
    structure.tracks.forEach((track, trackIndex) => {
        track.segments.forEach((segment, segmentIndex) => {
            const properties: SegmentProperties = {
                fileId: id,
                trackId: track.id,
                segmentId: segment.id,
                trackIndex,
                segmentIndex,
                rev: segment.rev,
                color: track.color !== undefined ? normalizeColor(track.color) : color,
                opacity: track.opacity,
                width: track.width,
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
                    : {
                          type: 'Feature',
                          geometry: {
                              type: 'LineString',
                              coordinates: toPositions(wasm.segment_coordinates(segment.id)),
                          },
                          properties,
                      }
            );
        });
    });

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
        const coordinates = toPositions(wasm.waypoint_coordinates(id));
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
        statistics: wasm.file_statistics(id) ?? EMPTY_STATISTICS,
        segments: { type: 'FeatureCollection', features: segments },
        waypoints,
        visibility: visibility.get(id) ?? new Map(),
    };
}
