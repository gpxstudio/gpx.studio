import { map } from '$lib/components/map/map';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import type { SelectionStatistics } from '$lib/engine';
import type { GeoJSONSource } from 'maplibre-gl';
import { get, writable } from 'svelte/store';

/** Lowest tolerance (m) of the reduction, the one of the engine. */
export const minTolerance = 0.1;

export const tolerance = writable<number>(0);

const SOURCE = 'simplified';

/**
 * Draws on the map what the selection would be reduced to with a tolerance, from the distances of
 * the engine (see `Engine.reductionDistances`). It is the same as the result of `Engine.reduce`.
 */
export class ReducedLayer {
    /** The number of trackpoints kept by the tolerance. */
    currentPoints = $state(0);
    /** The number of trackpoints of the selection. */
    maxPoints = $state(0);

    update(statistics: SelectionStatistics, distances: Float64Array, tolerance: number) {
        const { lng, lat, length } = statistics;
        const starts = statistics.anchors?.segmentStarts ?? new Uint32Array();

        const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
        let current = 0;
        // distances are for the same selection as the statistics, unless they are about to change
        const count = Math.min(length, distances.length);
        for (let i = 0; i < starts.length; i++) {
            const end = Math.min(i + 1 < starts.length ? starts[i + 1] : length, count);
            const coordinates: [number, number][] = [];
            for (let j = starts[i]; j < end; j++) {
                if (distances[j] > tolerance) {
                    coordinates.push([lng[j], lat[j]]);
                }
            }
            current += coordinates.length;
            data.features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates },
                properties: {},
            });
        }
        this.currentPoints = current;
        this.maxPoints = length;

        const map_ = get(map);
        if (!map_) {
            return;
        }
        const source = map_.getSource<GeoJSONSource>(SOURCE);
        if (source) {
            source.setData(data);
        } else {
            map_.addSource(SOURCE, { type: 'geojson', data });
        }
        if (!map_.getLayer(SOURCE)) {
            map_.addLayer(
                {
                    id: SOURCE,
                    type: 'line',
                    source: SOURCE,
                    paint: { 'line-color': 'white', 'line-width': 3 },
                },
                ANCHOR_LAYER_KEY.interactions
            );
        }
    }

    destroy() {
        const map_ = get(map);
        if (!map_) {
            return;
        }
        if (map_.getLayer(SOURCE)) {
            map_.removeLayer(SOURCE);
        }
        if (map_.getSource(SOURCE)) {
            map_.removeSource(SOURCE);
        }
    }
}
