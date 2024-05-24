
import { settings } from "$lib/db";
import { gpxStatistics } from "$lib/stores";
import { get } from "svelte/store";

const { distanceMarkers, distanceUnits } = settings;

export class DistanceMarkers {
    map: mapboxgl.Map;
    updateBinded: () => void = this.update.bind(this);

    constructor(map: mapboxgl.Map) {
        this.map = map;

        gpxStatistics.subscribe(this.updateBinded);
        distanceMarkers.subscribe(this.updateBinded);
        distanceUnits.subscribe(this.updateBinded);
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
                if (!this.map.getLayer('distance-markers')) {
                    this.map.addLayer({
                        id: 'distance-markers',
                        type: 'symbol',
                        source: 'distance-markers',
                        layout: {
                            'text-field': ['get', 'distance'],
                            'text-size': 12,
                            'text-font': ['Open Sans Regular'],
                            'icon-image': ['get', 'icon'],
                            'icon-padding': 50,
                            'icon-allow-overlap': true,
                        },
                        paint: {
                            'text-halo-width': 0.1,
                            'text-halo-color': 'black'
                        }
                    });
                } else {
                    this.map.moveLayer('distance-markers');
                }
            } else {
                if (this.map.getLayer('distance-markers')) {
                    this.map.removeLayer('distance-markers');
                }
            }
        } catch (e) { // No reliable way to check if the map is ready to add sources and layers
            return;
        }
    }

    getDistanceMarkersGeoJSON(): GeoJSON.FeatureCollection {
        let statistics = get(gpxStatistics);

        let features = [];
        let currentTargetDistance = 1;
        for (let i = 0; i < statistics.local.distance.length; i++) {
            if (statistics.local.distance[i] >= currentTargetDistance * (get(distanceUnits) === 'metric' ? 1 : 1.60934)) {
                let distance = currentTargetDistance.toFixed(0);
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [statistics.local.points[i].getLongitude(), statistics.local.points[i].getLatitude()]
                    },
                    properties: {
                        distance,
                        icon: distance.length < 3 ? 'circle-white-2' : 'circle-white-3'
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