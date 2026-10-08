/**
 * The statistics of an example file (a ride of 102 trackpoints with timestamps and temperatures),
 * for the pages that show the elevation profile and the statistics without a file: the home page
 * and the documentation. They are the ones that the engine computes for `example.gpx`, kept as
 * they are (see `example-data.ts`) so that the example does not need the engine.
 */
import type { GlobalStatistics, SelectionStatistics } from '$lib/engine';
import { exampleData as data } from './example-data';

const length = data.lng.length;

// the values that are cumulative over the selection: those of a range are the difference of its ends
const cumulative = {
    totalDistance: data.totalDistance,
    movingDistance: data.movingDistance,
    totalTime: data.totalTime,
    movingTime: data.movingTime,
    elevationGain: data.elevationGain,
    elevationLoss: data.elevationLoss,
};

/** The statistics of the trackpoints from `start` to `end` (both included), as the engine does. */
function slice(start: number, end: number): GlobalStatistics | undefined {
    if (!(start >= 0 && start <= end && end < length)) {
        return undefined;
    }
    const delta = (values: number[]) => values[end] - values[start];
    // the times are in ms, in seconds in the statistics; a range cannot last a negative time
    const totalTime = Math.max(0, delta(cumulative.totalTime));
    const movingTime = Math.max(0, delta(cumulative.movingTime));
    const totalDistance = delta(cumulative.totalDistance);
    const movingDistance = delta(cumulative.movingDistance);
    const hours = (ms: number) => ms / 3_600_000;
    return {
        ...data.global,
        totalDistance,
        movingDistance,
        totalTime: totalTime / 1000,
        movingTime: movingTime / 1000,
        elevationGain: delta(cumulative.elevationGain),
        elevationLoss: delta(cumulative.elevationLoss),
        startTime: data.timestamps[start],
        endTime: data.timestamps[end],
        totalSpeed: totalTime > 0 ? totalDistance / hours(totalTime) : undefined,
        movingSpeed: movingTime > 0 ? movingDistance / hours(movingTime) : undefined,
    };
}

export const exampleStatistics: SelectionStatistics = {
    global: data.global,
    length,
    totalDistance: Float64Array.from(data.totalDistance),
    slope: Float64Array.from(data.slope),
    lng: Float64Array.from(data.lng),
    lat: Float64Array.from(data.lat),
    ele: Float64Array.from(data.ele),
    timestamps: BigInt64Array.from(data.timestamps, (time) => BigInt(time)),
    speed: Float64Array.from(data.speed),
    atemp: Float64Array.from(data.atemp),
    slopeSegmentSlope: Float64Array.from(data.slopeSegmentSlope),
    slopeSegmentDistance: Float64Array.from(data.slopeSegmentDistance),
    slice,
};
