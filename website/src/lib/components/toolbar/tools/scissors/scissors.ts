import { get, writable, type Writable } from 'svelte/store';
import { engine, type SplitType as EngineSplitType } from '$lib/engine';
import { closestPointIndexIn } from '$lib/closest-point';

/** What a split cuts in two, the values being the ones of the engine. */
export const SplitType = {
    FILES: 'files',
    TRACKS: 'tracks',
    SEGMENTS: 'segments',
} as const satisfies Record<string, EngineSplitType>;
export type SplitType = (typeof SplitType)[keyof typeof SplitType];

export let splitAs: Writable<SplitType> = writable(SplitType.FILES);

/**
 * Splits at the trackpoint of a selected segment that is the closest to `point`, as `splitAs` says.
 * The statistics of the engine need to have the anchors (the scissors tool asks for them).
 */
export function splitAtPoint(segmentId: string, point: { lng: number; lat: number }) {
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
