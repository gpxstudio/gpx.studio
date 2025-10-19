import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { gpxStatistics, slicedGPXStatistics } from '$lib/logic/statistics';
import mapboxgl from 'mapbox-gl';
import { get } from 'svelte/store';
import { map } from '$lib/components/map/map';

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

        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(slicedGPXStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
    }

    update() {
        const map_ = get(map);
        if (!map_) return;

        const tool = get(currentTool);
        const statistics = get(slicedGPXStatistics)?.[0] ?? get(gpxStatistics);
        if (statistics.local.points.length > 0 && tool !== Tool.ROUTING) {
            this.start.setLngLat(statistics.local.points[0].getCoordinates()).addTo(map_);
            this.end
                .setLngLat(
                    statistics.local.points[statistics.local.points.length - 1].getCoordinates()
                )
                .addTo(map_);
        } else {
            this.start.remove();
            this.end.remove();
        }
    }

    remove() {
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());

        this.start.remove();
        this.end.remove();
    }
}
