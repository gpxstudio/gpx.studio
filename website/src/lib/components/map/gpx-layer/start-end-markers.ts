import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { gpxStatistics, slicedGPXStatistics } from '$lib/logic/statistics';
import maplibregl from 'maplibre-gl';
import { get } from 'svelte/store';
import { map } from '$lib/components/map/map';
import { allHidden } from '$lib/logic/hidden';

export class StartEndMarkers {
    start: maplibregl.Marker;
    end: maplibregl.Marker;
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor() {
        let startElement = document.createElement('div');
        let endElement = document.createElement('div');
        startElement.className = `h-4 w-4 rounded-full bg-green-500 border-2 border-white`;
        endElement.className = `h-4 w-4 rounded-full border-2 border-white`;
        endElement.style.background =
            'repeating-conic-gradient(#fff 0 90deg, #000 0 180deg) 0 0/8px 8px round';

        this.start = new maplibregl.Marker({ element: startElement });
        this.end = new maplibregl.Marker({ element: endElement });

        map.onLoad(() => this.update());
        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(slicedGPXStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
        this.unsubscribes.push(allHidden.subscribe(this.updateBinded));
    }

    update() {
        const map_ = get(map);
        if (!map_) return;

        const tool = get(currentTool);
        const statistics = get(gpxStatistics);
        const slicedStatistics = get(slicedGPXStatistics);
        const hidden = get(allHidden);
        if (statistics.global.length > 0 && tool !== Tool.ROUTING && !hidden) {
            this.start
                .setLngLat(
                    statistics.getTrackPoint(slicedStatistics?.[1] ?? 0)!.trkpt.getCoordinates()
                )
                .addTo(map_);
            this.end
                .setLngLat(
                    statistics
                        .getTrackPoint(slicedStatistics?.[2] ?? statistics.global.length - 1)!
                        .trkpt.getCoordinates()
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
