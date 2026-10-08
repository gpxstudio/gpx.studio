import { writable, type Writable } from 'svelte/store';
import { engine, type GlobalStatistics } from '$lib/engine';
import type { Coordinates } from '$lib/geo';

/** The part of the selection that is highlighted in the elevation profile. */
export type SlicedStatistics = {
    /** Statistics of the part. */
    global: GlobalStatistics;
    /** Indices of its first and last trackpoints in the statistics of the selection. */
    start: number;
    end: number;
};

export const slicedStatistics = writable<SlicedStatistics | undefined>(undefined);

// the indices only make sense for the selection they were made on
engine.statistics.subscribe(() => slicedStatistics.set(undefined));

/** The point of the elevation profile that the pointer is over, shown on the map. */
export const hoveredPoint: Writable<Coordinates | null> = writable(null);
