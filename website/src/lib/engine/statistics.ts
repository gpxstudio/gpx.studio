import { get, writable, type Readable } from 'svelte/store';
import { categoryIntervals, type CategoryIntervals } from '$lib/engine/trackpoint-categories';
import type { Backend } from './backend';
import {
    EMPTY_SELECTION_STATISTICS,
    EMPTY_STATISTICS,
    type SelectionStatistics,
    type StatisticsMetric,
    type StatisticsRequest,
} from './types';

/**
 * The statistics of the selection, read from the buffers of the engine. Only the metrics that a
 * consumer asked for are read (see `request`).
 */
export class StatisticsReader {
    private _store = writable<SelectionStatistics>(EMPTY_SELECTION_STATISTICS);
    readonly store: Readable<SelectionStatistics> = { subscribe: this._store.subscribe };
    /** Identifies the statistics currently in the engine's buffers. */
    private _version = 0;
    /** What each consumer of the statistics asked for. */
    private _requests = new Set<Set<StatisticsMetric>>();
    /** The metrics that were read for the current statistics. */
    private _loaded = new Set<StatisticsMetric>();

    /** The engine, as of the last time the statistics were read. */
    private _backend: Backend | null = null;

    /** @param enqueue Does a task after the calls to the engine that were made before it. */
    constructor(private enqueue: <T>(task: () => Promise<T>) => Promise<T>) {}

    /**
     * Reads the statistics of the selection again, after it or the files changed. Resolves to what
     * puts them in the store, for the caller to do it together with its other updates.
     */
    async refresh(backend: Backend): Promise<() => void> {
        this._backend = backend;
        const statistics = await this.read(backend);
        return () => this._store.set(statistics);
    }

    /**
     * Reads the statistics buffers of the engine (the getters copy them), but only the metrics
     * that were requested.
     */
    private async read(backend: Backend): Promise<SelectionStatistics> {
        const version = ++this._version;
        this._loaded.clear();
        const [global, totalDistance, slope, lng, lat, ele, timestamps] = await Promise.all([
            backend.selection_statistics(),
            backend.total_distance(),
            backend.slope(),
            backend.lng(),
            backend.lat(),
            backend.ele(),
            backend.timestamps(),
        ]);
        const statistics: SelectionStatistics = {
            global: global ?? EMPTY_STATISTICS,
            length: totalDistance.length,
            totalDistance,
            slope,
            lng,
            lat,
            ele,
            timestamps,
            slice: (start, end) =>
                this.enqueue(async () =>
                    version === this._version ? backend.slice_statistics(start, end) : undefined
                ),
        };
        await this.readMetrics(backend, statistics, this.requestedMetrics());
        return statistics;
    }

    private requestedMetrics(): Set<StatisticsMetric> {
        const metrics = new Set<StatisticsMetric>();
        this._requests.forEach((request) => request.forEach((m) => metrics.add(m)));
        return metrics;
    }

    /** Reads the metrics that were not read yet into `statistics`, which is the current one. */
    private async readMetrics(
        backend: Backend,
        statistics: SelectionStatistics,
        metrics: Set<StatisticsMetric>
    ) {
        const categories = async (
            starts: Promise<Uint32Array>,
            values: Promise<Uint8Array>,
            names: Promise<string[]>
        ): Promise<CategoryIntervals> => {
            const [s, v, n] = await Promise.all([starts, values, names]);
            return { starts: s, values: v, names: n };
        };

        const missing = [...metrics].filter((metric) => !this._loaded.has(metric));
        missing.forEach((metric) => this._loaded.add(metric));
        await Promise.all(
            missing.map(async (metric) => {
                switch (metric) {
                    case 'speed':
                        statistics.speed = await backend.speed();
                        break;
                    case 'hr':
                        statistics.hr = await backend.hr();
                        break;
                    case 'cad':
                        statistics.cad = await backend.cad();
                        break;
                    case 'atemp':
                        statistics.atemp = await backend.atemp();
                        break;
                    case 'power':
                        statistics.power = await backend.power();
                        break;
                    case 'slopeSegment':
                        [statistics.slopeSegmentSlope, statistics.slopeSegmentDistance] =
                            await Promise.all([
                                backend.slope_segment_slope(),
                                backend.slope_segment_distance(),
                            ]);
                        break;
                    case 'surface':
                        statistics.surface = await categories(
                            backend.surface_starts(),
                            backend.surface_values(),
                            backend.surfaces()
                        );
                        break;
                    case 'anchors': {
                        const [indices, zooms, segmentStarts, segmentIds, revision] =
                            await Promise.all([
                                backend.anchor_indices(),
                                backend.anchor_zooms(),
                                backend.segment_starts(),
                                backend.segment_ids(),
                                backend.routing_revision(),
                            ]);
                        statistics.anchors = {
                            indices,
                            zooms,
                            segmentStarts,
                            segmentIds,
                            revision,
                        };
                        break;
                    }
                    case 'highway':
                        [statistics.highway, statistics.sacScale, statistics.mtbScale] =
                            await Promise.all([
                                categories(
                                    backend.highway_starts(),
                                    backend.highway_values(),
                                    backend.highways()
                                ),
                                categories(
                                    backend.sac_scale_starts(),
                                    backend.sac_scale_values(),
                                    backend.sac_scales()
                                ),
                                categories(
                                    backend.mtb_scale_starts(),
                                    backend.mtb_scale_values(),
                                    backend.mtb_scales()
                                ),
                            ]);
                        break;
                }
            })
        );
    }

    /**
     * Registers a consumer of the statistics that needs some of the metrics that are not part of
     * them by default (see `StatisticsMetric`). The metrics asked for by all the consumers are
     * added to `statistics`: the ones that are missing are read right away, and then after each
     * change of the selection or of the files, and the store is updated. Call `release` when the
     * consumer goes away.
     */
    request(): StatisticsRequest {
        const wanted = new Set<StatisticsMetric>();
        this._requests.add(wanted);
        return {
            set: (metrics) => {
                wanted.clear();
                for (const metric of metrics) {
                    wanted.add(metric);
                }
                return this.loadMissing();
            },
            release: () => {
                this._requests.delete(wanted);
            },
        };
    }

    /** Reads the requested metrics that are not in the current statistics yet. */
    private async loadMissing() {
        const metrics = this.requestedMetrics();
        if ([...metrics].every((metric) => this._loaded.has(metric))) {
            return;
        }
        // queued, so that the buffers of the engine still are the ones of the current statistics:
        // they are read after every action
        await this.enqueue(async () => {
            const backend = this._backend;
            const requested = this.requestedMetrics();
            if (!backend || [...requested].every((metric) => this._loaded.has(metric))) {
                return;
            }
            const statistics = { ...get(this._store) };
            await this.readMetrics(backend, statistics, requested);
            this._store.set(statistics);
        });
    }
}
