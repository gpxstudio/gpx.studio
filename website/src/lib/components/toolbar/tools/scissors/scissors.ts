import { get, writable, type Writable } from 'svelte/store';
import { engine, type Selection, type SplitType as EngineSplitType } from '$lib/engine';
import { selectedFileIds } from '$lib/engine/selection-helpers';
import { closestPointIndexIn } from '$lib/geo/closest-point';

/** What a split cuts in two, the values being the ones of the engine. */
export const SplitType = {
    FILES: 'files',
    ROUTES: 'routes',
    TRACKS: 'tracks',
    SEGMENTS: 'segments',
} as const satisfies Record<string, EngineSplitType>;
export type SplitType = (typeof SplitType)[keyof typeof SplitType];

export const splitAs: Writable<SplitType> = writable(SplitType.FILES);

/** The ids of the segments of the routes of the files of the selection. */
export function routeSegmentIds(selection: Selection): Set<string> {
    const files = get(engine.files);
    return new Set(
        selectedFileIds(selection).flatMap((fileId) => {
            const file = files.get(fileId);
            return file ? get(file).structure.routes.map((route) => route.segment.id) : [];
        })
    );
}

/**
 * The ways the selection can be split: as files always, as routes if it has routes, as tracks or
 * segments if it has tracks with segments (the engine does nothing for a trackpoint that is not in
 * what it is asked to cut).
 */
export function availableSplitTypes(selection: Selection): SplitType[] {
    let routes = false;
    let tracks = false;
    if (selection.type === 'route') {
        routes = true;
    } else if (selection.type === 'track' || selection.type === 'segment') {
        tracks = true;
    } else {
        const files = get(engine.files);
        for (const fileId of selectedFileIds(selection)) {
            const file = files.get(fileId);
            if (file) {
                const { structure } = get(file);
                routes ||= structure.routes.length > 0;
                tracks ||= structure.tracks.some((track) => track.segments.length > 0);
            }
        }
    }
    return [
        SplitType.FILES,
        ...(routes ? [SplitType.ROUTES] : []),
        ...(tracks ? [SplitType.TRACKS, SplitType.SEGMENTS] : []),
    ];
}

/** Whether splitting as `type` cuts something at a trackpoint of a segment, which is a route's or not. */
export function cuts(type: SplitType, inRoute: boolean): boolean {
    return type === SplitType.FILES || (type === SplitType.ROUTES) === inRoute;
}

/**
 * Splits at the trackpoint of a selected segment that is the closest to `point`, as `splitAs` says
 * (nothing happens if the segment cannot be split that way).
 * The statistics of the engine need to have the anchors (the scissors tool asks for them).
 */
export function splitAtPoint(segmentId: string, point: { lng: number; lat: number }) {
    const inRoute = routeSegmentIds(get(engine.selection)).has(segmentId);
    if (!cuts(get(splitAs), inRoute)) {
        return;
    }
    const statistics = get(engine.statistics);
    const anchors = statistics.anchors;
    const segment = anchors?.segmentIds.indexOf(segmentId) ?? -1;
    if (!anchors || segment < 0) {
        return;
    }
    const starts = anchors.segmentStarts;
    const end = segment + 1 < starts.length ? starts[segment + 1] : statistics.length;
    const index = closestPointIndexIn(statistics.lng, statistics.lat, starts[segment], end, point);
    if (index !== undefined) {
        engine.split(anchors.revision, index, get(splitAs));
    }
}
