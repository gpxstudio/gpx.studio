import { gpxStatistics, slicedGPXStatistics, currentTool, Tool } from '$lib/stores';
import mapboxgl from 'mapbox-gl';
import { get } from 'svelte/store';

const HIGHLIGHT_SOURCE_ID = 'elevation-selection';
const HIGHLIGHT_LAYER_CASING_ID = 'elevation-selection-casing';
const HIGHLIGHT_LAYER_ID = 'elevation-selection';

export class StartEndMarkers {
    map: mapboxgl.Map;
    start: mapboxgl.Marker;
    end: mapboxgl.Marker;
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor(map: mapboxgl.Map) {
        this.map = map;

        let startElement = document.createElement('div');
        let endElement = document.createElement('div');
        startElement.className = `h-4 w-4 rounded-full bg-green-500 border-2 border-white`;
        endElement.className = `h-4 w-4 rounded-full border-2 border-white`;
        endElement.style.background =
            'repeating-conic-gradient(#fff 0 90deg, #000 0 180deg) 0 0/8px 8px round';

        this.start = new mapboxgl.Marker({ element: startElement });
        this.end = new mapboxgl.Marker({ element: endElement });

        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(slicedGPXStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
    }

    private ensureHighlightLayers() {
        if (!this.map.getSource(HIGHLIGHT_SOURCE_ID)) {
            this.map.addSource(HIGHLIGHT_SOURCE_ID, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [] },
                    properties: {},
                },
            });
        }
        if (!this.map.getLayer(HIGHLIGHT_LAYER_CASING_ID)) {
            this.map.addLayer({
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
        if (!this.map.getLayer(HIGHLIGHT_LAYER_ID)) {
            this.map.addLayer({
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
            this.map.moveLayer(HIGHLIGHT_LAYER_CASING_ID);
            this.map.moveLayer(HIGHLIGHT_LAYER_ID);
        } catch (e) {
            // ignore if already on top or not movable yet
        }
    }

    private removeHighlight() {
        if (this.map.getLayer(HIGHLIGHT_LAYER_ID)) this.map.removeLayer(HIGHLIGHT_LAYER_ID);
        if (this.map.getLayer(HIGHLIGHT_LAYER_CASING_ID)) this.map.removeLayer(HIGHLIGHT_LAYER_CASING_ID);
        if (this.map.getSource(HIGHLIGHT_SOURCE_ID)) this.map.removeSource(HIGHLIGHT_SOURCE_ID);
    }


    private updateMapHighlight() {
        let statistics = get(slicedGPXStatistics)?.[0]
        if (!statistics) {
            this.removeHighlight();
            return;
        }
        const coords: [number, number][] = [];
        for (const c of statistics.local.points) {
            coords.push([c.getCoordinates().lon, c.getCoordinates().lat]);
        }
        this.ensureHighlightLayers();
        const src = this.map.getSource(HIGHLIGHT_SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (src) {
            src.setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {},
            });
        }
        if (this.map.getLayer(HIGHLIGHT_LAYER_CASING_ID)) {
            this.map.setPaintProperty(
                HIGHLIGHT_LAYER_CASING_ID,
                'line-color',
                '#000000'
            );
        }
        try {
            this.map.moveLayer(HIGHLIGHT_LAYER_CASING_ID);
            this.map.moveLayer(HIGHLIGHT_LAYER_ID);
        } catch (e) {}
    }

    update() {
        let tool = get(currentTool);
        let statistics = get(slicedGPXStatistics)?.[0] ?? get(gpxStatistics);
        if (statistics.local.points.length > 0 && tool !== Tool.ROUTING) {
            this.start.setLngLat(statistics.local.points[0].getCoordinates()).addTo(this.map);
            this.end
                .setLngLat(
                    statistics.local.points[statistics.local.points.length - 1].getCoordinates()
                )
                .addTo(this.map);
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
