import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { splitAs } from '$lib/components/toolbar/tools/scissors/scissors';
import { Scissors } from 'lucide-static';
import { get } from 'svelte/store';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import type { GeoJSONSource } from 'maplibre-gl';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import type { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';
import { loadSVGIcon } from '$lib/utils';
import {
    engine,
    type Selection,
    type SelectionStatistics,
    type StatisticsRequest,
} from '$lib/engine';

/**
 * The anchors inside the segments of the selection, where a click splits the file, the track or
 * the segment: a command of the engine, which finds them by the index of their trackpoint in the
 * selection.
 */
export class SplitControls {
    map: maplibregl.Map;
    layerEventManager: MapLayerEventManager;
    unsubscribes: Function[] = [];
    /** What the tool needs from the engine, while it shows the anchors. */
    request: StatisticsRequest = engine.requestStatistics();
    selection: Selection = { type: 'empty' };
    statistics: SelectionStatistics | undefined = undefined;

    layerOnMouseEnterBinded: (e: any) => void = this.layerOnMouseEnter.bind(this);
    layerOnMouseLeaveBinded: () => void = this.layerOnMouseLeave.bind(this);
    layerOnClickBinded: (e: any) => void = this.layerOnClick.bind(this);

    constructor(map: maplibregl.Map, layerEventManager: MapLayerEventManager) {
        this.map = map;
        this.layerEventManager = layerEventManager;
        loadSVGIcon(
            this.map,
            'split-control',
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="20" fill="white" />
                <g transform="translate(8 8)">
                ${Scissors.replace('stroke="currentColor"', 'stroke="black"')}
                </g>
            </svg>`
        );

        this.unsubscribes.push(
            engine.statistics.subscribe((statistics) => {
                this.statistics = statistics;
                this.addIfNeeded();
            })
        );
        this.unsubscribes.push(currentTool.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(
            engine.selection.subscribe((selection) => {
                this.selection = selection;
                this.addIfNeeded();
            })
        );
    }

    addIfNeeded() {
        // the tool works on files, tracks and segments, not on waypoints
        const scissors =
            get(currentTool) === Tool.SCISSORS &&
            (this.selection.type === 'file' ||
                this.selection.type === 'track' ||
                this.selection.type === 'segment');
        this.request.set(scissors ? ['anchors'] : []);
        if (!scissors) {
            this.remove();
            return;
        }

        this.updateControls();
    }

    /** The anchors that are inside a segment, which is not where it starts or ends. */
    inner(): GeoJSON.Feature[] {
        const statistics = this.statistics;
        const anchors = statistics?.anchors;
        if (!statistics || !anchors) {
            return [];
        }
        const starts = anchors.segmentStarts;
        const features: GeoJSON.Feature[] = [];
        let segment = 0;
        for (let i = 0; i < anchors.indices.length; i++) {
            const index = anchors.indices[i];
            // the anchors are sorted: the segment can only be the same or a following one
            while (segment + 1 < starts.length && starts[segment + 1] <= index) {
                segment++;
            }
            const end = segment + 1 < starts.length ? starts[segment + 1] : statistics.length;
            if (index > starts[segment] && index < end - 1) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [statistics.lng[index], statistics.lat[index]],
                    },
                    properties: { index, minZoom: anchors.zooms[i] },
                });
            }
        }
        return features;
    }

    updateControls() {
        const data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: this.inner(),
        };

        try {
            let source = this.map.getSource('split-controls') as GeoJSONSource | undefined;
            if (source) {
                source.setData(data);
            } else {
                this.map.addSource('split-controls', {
                    type: 'geojson',
                    data: data,
                });
            }

            if (!this.map.getLayer('split-controls')) {
                this.map.addLayer(
                    {
                        id: 'split-controls',
                        type: 'symbol',
                        source: 'split-controls',
                        layout: {
                            'icon-image': 'split-control',
                            'icon-size': 0.25,
                            'icon-padding': 0,
                        },
                        filter: ['<=', ['get', 'minZoom'], ['zoom']],
                    },
                    ANCHOR_LAYER_KEY.interactions
                );

                this.layerEventManager.on(
                    'mouseenter',
                    'split-controls',
                    this.layerOnMouseEnterBinded
                );
                this.layerEventManager.on(
                    'mouseleave',
                    'split-controls',
                    this.layerOnMouseLeaveBinded
                );
                this.layerEventManager.on('click', 'split-controls', this.layerOnClickBinded);
            }
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
        }
    }

    remove() {
        this.layerEventManager.off('mouseenter', 'split-controls', this.layerOnMouseEnterBinded);
        this.layerEventManager.off('mouseleave', 'split-controls', this.layerOnMouseLeaveBinded);
        this.layerEventManager.off('click', 'split-controls', this.layerOnClickBinded);

        try {
            if (this.map.getLayer('split-controls')) {
                this.map.removeLayer('split-controls');
            }

            if (this.map.getSource('split-controls')) {
                this.map.removeSource('split-controls');
            }
        } catch (e) {
            // No reliable way to check if the map is ready to remove sources and layers
        }
    }

    layerOnMouseEnter(e: any) {
        mapCursor.notify(MapCursorState.SPLIT_CONTROL, true);
    }

    layerOnMouseLeave() {
        mapCursor.notify(MapCursorState.SPLIT_CONTROL, false);
    }

    layerOnClick(e: maplibregl.MapLayerMouseEvent) {
        const revision = this.statistics?.anchors?.revision;
        if (revision !== undefined) {
            engine.split(revision, e.features![0].properties!.index, get(splitAs));
        }
    }

    destroy() {
        this.remove();
        this.request.release();
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    }
}
