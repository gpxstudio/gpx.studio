import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { gpxStatistics, slicedGPXStatistics } from '$lib/logic/statistics';
import mapboxgl from 'mapbox-gl';
import { get } from 'svelte/store';
import { map } from '$lib/components/map/map';
import { allHidden } from '$lib/logic/hidden';

const HIGHLIGHT_SOURCE_ID = 'elevation-selection';
const HIGHLIGHT_LAYER_CASING_ID = 'elevation-selection-casing';
const HIGHLIGHT_LAYER_ID = 'elevation-selection';

export class StartEndMarkers {
    start: mapboxgl.Marker;
    end: mapboxgl.Marker;
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor() {
        let startElement = document.createElement('div');
        let endElement = document.createElement('div');
        startElement.className = `h-4 w-4 rounded-full bg-green-500 border-2 border-white`;
        endElement.className = `h-4 w-4 rounded-full border-2 border-white`;
        endElement.style.background =
            'repeating-conic-gradient(#fff 0 90deg, #000 0 180deg) 0 0/8px 8px round';

        this.start = new mapboxgl.Marker({ element: startElement });
        this.end = new mapboxgl.Marker({ element: endElement });

        map.onLoad(() => this.update());
        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(slicedGPXStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
        this.unsubscribes.push(allHidden.subscribe(this.updateBinded));
    }

    private ensureHighlightLayers() {
        const map_ = get(map);
        if (!map_) return;

        if (!map_.getSource(HIGHLIGHT_SOURCE_ID)) {
            map_.addSource(HIGHLIGHT_SOURCE_ID, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [] },
                    properties: {},
                },
            });
        }
        if (!map_.getLayer(HIGHLIGHT_LAYER_CASING_ID)) {
            map_.addLayer({
                id: HIGHLIGHT_LAYER_CASING_ID,
                type: 'line',
                source: HIGHLIGHT_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#000000',
                    'line-width': 10,
                    'line-opacity': 0.9,
                    'line-blur': 0.2,
                },
            });
        }
        if (!map_.getLayer(HIGHLIGHT_LAYER_ID)) {
            map_.addLayer({
                id: HIGHLIGHT_LAYER_ID,
                type: 'line',
                source: HIGHLIGHT_SOURCE_ID,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#ffeb3b',
                    'line-width': 6,
                    'line-opacity': 1,
                },
            });
        }
        try {
            map_.moveLayer(HIGHLIGHT_LAYER_CASING_ID);
            map_.moveLayer(HIGHLIGHT_LAYER_ID);
        } catch (e) {
            // ignore if already on top or not movable yet
        }
    }

    private removeHighlight() {
        const map_ = get(map);
        if (!map_) return;

        if (map_.getLayer(HIGHLIGHT_LAYER_ID)) map_.removeLayer(HIGHLIGHT_LAYER_ID);
        if (map_.getLayer(HIGHLIGHT_LAYER_CASING_ID)) map_.removeLayer(HIGHLIGHT_LAYER_CASING_ID);
        if (map_.getSource(HIGHLIGHT_SOURCE_ID)) map_.removeSource(HIGHLIGHT_SOURCE_ID);
    }

    private updateMapHighlight() {
        const map_ = get(map);
        if (!map_) return;

        let statistics = get(slicedGPXStatistics)?.[0];
        if (!statistics) {
            this.removeHighlight();
            return;
        }
        const coords: [number, number][] = [];
        for (const c of statistics.local.points) {
            coords.push([c.getCoordinates().lon, c.getCoordinates().lat]);
        }
        this.ensureHighlightLayers();
        const src = map_.getSource(HIGHLIGHT_SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (src) {
            src.setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {},
            });
        }
        if (map_.getLayer(HIGHLIGHT_LAYER_CASING_ID)) {
            map_.setPaintProperty(
                HIGHLIGHT_LAYER_CASING_ID,
                'line-color',
                '#000000'
            );
        }
        try {
            map_.moveLayer(HIGHLIGHT_LAYER_CASING_ID);
            map_.moveLayer(HIGHLIGHT_LAYER_ID);
        } catch (e) {}
    }

    update() {
        const map_ = get(map);
        if (!map_) return;

        const tool = get(currentTool);
        const statistics = get(slicedGPXStatistics)?.[0] ?? get(gpxStatistics);
        const hidden = get(allHidden);
        if (statistics.local.points.length > 0 && tool !== Tool.ROUTING && !hidden) {
            this.start.setLngLat(statistics.local.points[0].getCoordinates()).addTo(map_);
            this.end
                .setLngLat(
                    statistics.local.points[statistics.local.points.length - 1].getCoordinates()
                )
                .addTo(map_);
            this.updateMapHighlight();
        } else {
            this.start.remove();
            this.end.remove();
            this.removeHighlight();
        }
    }

    remove() {
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());

        this.start.remove();
        this.end.remove();

        this.removeHighlight();
    }
}
