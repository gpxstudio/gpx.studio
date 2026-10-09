import { get, writable, type Readable } from 'svelte/store';
import { categoryIntervals, type CategoryIntervals } from '$lib/trackpoint-categories';
import type { Wasm } from './convert';
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

    /** @param wasm The engine, `null` before it is loaded. */
    constructor(private wasm: () => Wasm | null) {}

    /** Reads the statistics of the selection again, after it or the files changed. */
    refresh(wasm: Wasm) {
        this._store.set(this.read(wasm));
    }

    /**
     * Reads the statistics buffers of the engine (the getters copy them), but only the metrics
     * that were requested.
     */
    private read(wasm: Wasm): SelectionStatistics {
        const version = ++this._version;
        this._loaded.clear();
        const totalDistance = wasm.total_distance();
        const statistics: SelectionStatistics = {
            global: wasm.selection_statistics() ?? EMPTY_STATISTICS,
            length: totalDistance.length,
            totalDistance,
            slope: wasm.slope(),
            lng: wasm.lng(),
            lat: wasm.lat(),
            ele: wasm.ele(),
            timestamps: wasm.timestamps(),
            slice: (start, end) =>
                version === this._version ? wasm.slice_statistics(start, end) : undefined,
        };
        this.readMetrics(wasm, statistics, this.requestedMetrics());
        return statistics;
    }

    private requestedMetrics(): Set<StatisticsMetric> {
        const metrics = new Set<StatisticsMetric>();
        this._requests.forEach((request) => request.forEach((m) => metrics.add(m)));
        return metrics;
    }

    /** Reads the metrics that were not read yet into `statistics`, which is the current one. */
    private readMetrics(
        wasm: Wasm,
        statistics: SelectionStatistics,
        metrics: Set<StatisticsMetric>
    ) {
        const categories = (
            starts: Uint32Array,
            values: Uint8Array,
            names: () => string[]
        ): CategoryIntervals => ({
            starts,
            values,
            names: names(),
        });

        for (const metric of metrics) {
            if (this._loaded.has(metric)) {
                continue;
            }
            this._loaded.add(metric);
            switch (metric) {
                case 'speed':
                    statistics.speed = wasm.speed();
                    break;
                case 'hr':
                    statistics.hr = wasm.hr();
                    break;
                case 'cad':
                    statistics.cad = wasm.cad();
                    break;
                case 'atemp':
                    statistics.atemp = wasm.atemp();
                    break;
                case 'power':
                    statistics.power = wasm.power();
                    break;
                case 'slopeSegment':
                    statistics.slopeSegmentSlope = wasm.slope_segment_slope();
                    statistics.slopeSegmentDistance = wasm.slope_segment_distance();
                    break;
                case 'surface':
                    statistics.surface = categories(
                        wasm.surface_starts(),
                        wasm.surface_values(),
                        wasm.surfaces
                    );
                    break;
                case 'anchors':
                    statistics.anchors = {
                        indices: wasm.anchor_indices(),
                        zooms: wasm.anchor_zooms(),
                        segmentStarts: wasm.segment_starts(),
                        segmentIds: wasm.segment_ids(),
                        revision: wasm.routing_revision(),
                    };
                    break;
                case 'highway':
                    statistics.highway = categories(
                        wasm.highway_starts(),
                        wasm.highway_values(),
                        wasm.highways
                    );
                    statistics.sacScale = categories(
                        wasm.sac_scale_starts(),
                        wasm.sac_scale_values(),
                        wasm.sac_scales
                    );
                    statistics.mtbScale = categories(
                        wasm.mtb_scale_starts(),
                        wasm.mtb_scale_values(),
                        wasm.mtb_scales
                    );
                    break;
            }
        }
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
                this.loadMissing();
            },
            release: () => {
                this._requests.delete(wanted);
            },
        };
    }

    /** Reads the requested metrics that are not in the current statistics yet. */
    private loadMissing() {
        const wasm = this.wasm();
        const metrics = this.requestedMetrics();
        if (!wasm || [...metrics].every((metric) => this._loaded.has(metric))) {
            return;
        }
        // the buffers of the engine still are the ones of the current statistics, as they are
        // read after every action
        const statistics = { ...get(this._store) };
        this.readMetrics(wasm, statistics, metrics);
        this._store.set(statistics);
    }
}
