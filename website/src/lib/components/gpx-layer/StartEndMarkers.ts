import { gpxStatistics, currentTool, Tool } from "$lib/stores";
import mapboxgl from "mapbox-gl";
import { get } from "svelte/store";

export class StartEndMarkers {
    map: mapboxgl.Map;
    start: mapboxgl.Marker;
    end: mapboxgl.Marker;
    updateBinded: () => void = this.update.bind(this);

    constructor(map: mapboxgl.Map) {
        this.map = map;

        let startElement = document.createElement('div');
        let endElement = document.createElement('div');
        startElement.className = `h-4 w-4 rounded-full bg-green-500 border-2 border-white`;
        endElement.className = `h-4 w-4 rounded-full border-2 border-white`;
        endElement.style.background = 'repeating-conic-gradient(#fff 0 90deg, #000 0 180deg) 0 0/8px 8px round';

        this.start = new mapboxgl.Marker({ element: startElement });
        this.end = new mapboxgl.Marker({ element: endElement });

        gpxStatistics.subscribe(this.updateBinded);
        currentTool.subscribe(this.updateBinded);
    }

    update() {
        let statistics = get(gpxStatistics);
        if (statistics.local.points.length > 0 && get(currentTool) !== Tool.ROUTING) {
            this.start.setLngLat(statistics.local.points[0].getCoordinates()).addTo(this.map);
            this.end.setLngLat(statistics.local.points[statistics.local.points.length - 1].getCoordinates()).addTo(this.map);
        } else {
            this.start.remove();
            this.end.remove();
        }
    }
}