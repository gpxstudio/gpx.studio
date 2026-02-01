import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { gpxStatistics, hoveredPoint, slicedGPXStatistics } from '$lib/logic/statistics';
import type { GeoJSONSource } from 'maplibre-gl';
import { get } from 'svelte/store';
import { map } from '$lib/components/map/map';
import { allHidden } from '$lib/logic/hidden';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import { loadSVGIcon } from '$lib/utils';

const startMarkerSVG = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <circle cx="8" cy="8" r="6" fill="#22c55e" stroke="white" stroke-width="1.5"/>
</svg>`;

const endMarkerSVG = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="checkerboard" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="2.5" height="2.5" fill="white"/>
      <rect x="2.5" y="2.5" width="2.5" height="2.5" fill="white"/>
      <rect x="2.5" y="0" width="2.5" height="2.5" fill="black"/>
      <rect x="0" y="2.5" width="2.5" height="2.5" fill="black"/>
    </pattern>
  </defs>
  <circle cx="8" cy="8" r="6" fill="url(#checkerboard)" stroke="white" stroke-width="1.5"/>
</svg>`;
const hoverMarkerSVG = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <circle cx="8" cy="8" r="6" fill="#00b8db" stroke="white" stroke-width="1.5"/>
</svg>`;

export class StartEndMarkers {
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor() {
        map.onLoad(() => this.update());
        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(slicedGPXStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(hoveredPoint.subscribe(this.updateBinded));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
        this.unsubscribes.push(allHidden.subscribe(this.updateBinded));
    }

    update() {
        const map_ = get(map);
        if (!map_) return;

        this.loadIcons();

        const tool = get(currentTool);
        const statistics = get(gpxStatistics);
        const slicedStatistics = get(slicedGPXStatistics);
        const hovered = get(hoveredPoint);
        const hidden = get(allHidden);
        if (statistics.global.length > 0 && tool !== Tool.ROUTING && !hidden) {
            const start = statistics
                .getTrackPoint(slicedStatistics?.[1] ?? 0)!
                .trkpt.getCoordinates();
            const end = statistics
                .getTrackPoint(slicedStatistics?.[2] ?? statistics.global.length - 1)!
                .trkpt.getCoordinates();
            const data: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [start.lon, start.lat],
                        },
                        properties: {
                            icon: 'start-marker',
                        },
                    },
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [end.lon, end.lat],
                        },
                        properties: {
                            icon: 'end-marker',
                        },
                    },
                ],
            };

            if (hovered) {
                data.features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [hovered.lon, hovered.lat],
                    },
                    properties: {
                        icon: 'hover-marker',
                    },
                });
            }

            let source = map_.getSource('start-end-markers') as GeoJSONSource | undefined;
            if (source) {
                source.setData(data);
            } else {
                map_.addSource('start-end-markers', {
                    type: 'geojson',
                    data: data,
                });
            }

            if (!map_.getLayer('start-end-markers')) {
                map_.addLayer(
                    {
                        id: 'start-end-markers',
                        type: 'symbol',
                        source: 'start-end-markers',
                        layout: {
                            'icon-image': ['get', 'icon'],
                            'icon-size': 0.2,
                            'icon-allow-overlap': true,
                        },
                    },
                    ANCHOR_LAYER_KEY.startEndMarkers
                );
            }
        } else {
            if (map_.getLayer('start-end-markers')) {
                map_.removeLayer('start-end-markers');
            }
            if (map_.getSource('start-end-markers')) {
                map_.removeSource('start-end-markers');
            }
        }
    }

    remove() {
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());

        const map_ = get(map);
        if (!map_) return;

        if (map_.getLayer('start-end-markers')) {
            map_.removeLayer('start-end-markers');
        }
        if (map_.getSource('start-end-markers')) {
            map_.removeSource('start-end-markers');
        }
    }

    loadIcons() {
        const map_ = get(map);
        if (!map_) return;
        loadSVGIcon(map_, 'start-marker', startMarkerSVG);
        loadSVGIcon(map_, 'end-marker', endMarkerSVG);
        loadSVGIcon(map_, 'hover-marker', hoverMarkerSVG);
    }
}
