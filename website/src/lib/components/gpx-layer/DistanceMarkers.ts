
import { settings } from "$lib/db";
import { gpxStatistics } from "$lib/stores";
import { get } from "svelte/store";

const { distanceMarkers, distanceUnits } = settings;

const stops = [[100, 0], [50, 7], [25, 8, 10], [10, 10], [5, 11], [1, 13]];

export class DistanceMarkers {
    map: mapboxgl.Map;
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor(map: mapboxgl.Map) {
        this.map = map;

        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(distanceMarkers.subscribe(this.updateBinded));
        this.unsubscribes.push(distanceUnits.subscribe(this.updateBinded));
        this.map.on('style.import.load', this.updateBinded);
    }

    update() {
        try {
            if (get(distanceMarkers)) {
                let distanceSource = this.map.getSource('distance-markers');
                if (distanceSource) {
                    distanceSource.setData(this.getDistanceMarkersGeoJSON());
                } else {
                    this.map.addSource('distance-markers', {
                        type: 'geojson',
                        data: this.getDistanceMarkersGeoJSON()
                    });
                }
                stops.forEach(([d, minzoom, maxzoom]) => {
                    if (!this.map.getLayer(`distance-markers-${d}`)) {
                        this.map.addLayer({
                            id: `distance-markers-${d}`,
                            type: 'symbol',
                            source: 'distance-markers',
                            filter: d === 5 ? ['any', ['==', ['get', 'level'], 5], ['==', ['get', 'level'], 25]] : ['==', ['get', 'level'], d],
                            minzoom: minzoom,
                            maxzoom: maxzoom ?? 24,
                            layout: {
                                'text-field': ['get', 'distance'],
                                'text-size': 14,
                                'text-font': ['Open Sans Bold'],
                            },
                            paint: {
                                'text-color': 'black',
                                'text-halo-width': 2,
                                'text-halo-color': 'white',
                            }
                        });
                    } else {
                        this.map.moveLayer(`distance-markers-${d}`);
                    }
                });
            } else {
                stops.forEach(([d]) => {
                    if (this.map.getLayer(`distance-markers-${d}`)) {
                        this.map.removeLayer(`distance-markers-${d}`);
                    }
                });
            }
        } catch (e) { // No reliable way to check if the map is ready to add sources and layers
            return;
        }
    }

    remove() {
        this.unsubscribes.forEach(unsubscribe => unsubscribe());
    }

    getDistanceMarkersGeoJSON(): GeoJSON.FeatureCollection {
        let statistics = get(gpxStatistics);

        let features = [];
        let currentTargetDistance = 1;
        for (let i = 0; i < statistics.local.distance.total.length; i++) {
            if (statistics.local.distance.total[i] >= currentTargetDistance * (get(distanceUnits) === 'metric' ? 1 : 1.60934)) {
                let distance = currentTargetDistance.toFixed(0);
                let [level, minzoom] = stops.find(([d]) => currentTargetDistance % d === 0) ?? [0, 0];
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [statistics.local.points[i].getLongitude(), statistics.local.points[i].getLatitude()]
                    },
                    properties: {
                        distance,
                        level,
                        minzoom,
                    }
                } as GeoJSON.Feature);
                currentTargetDistance += 1;
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }
}