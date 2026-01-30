import { settings } from '$lib/logic/settings';
import { gpxStatistics } from '$lib/logic/statistics';
import { getConvertedDistanceToKilometers } from '$lib/units';
import { get } from 'svelte/store';
import { map } from '$lib/components/map/map';
import { allHidden } from '$lib/logic/hidden';
import type { GeoJSONSource } from 'maplibre-gl';
import { ANCHOR_LAYER_KEY } from '../style';

const { distanceMarkers, distanceUnits } = settings;

const levels = [100, 50, 25, 10, 5, 1];

export class DistanceMarkers {
    updateBinded: () => void = this.update.bind(this);
    unsubscribes: (() => void)[] = [];

    constructor() {
        this.unsubscribes.push(gpxStatistics.subscribe(this.updateBinded));
        this.unsubscribes.push(distanceMarkers.subscribe(this.updateBinded));
        this.unsubscribes.push(distanceUnits.subscribe(this.updateBinded));
        this.unsubscribes.push(allHidden.subscribe(this.updateBinded));
        this.unsubscribes.push(
            map.subscribe((map_) => {
                if (map_) {
                    map_.on('style.load', this.updateBinded);
                }
            })
        );
    }

    update() {
        const map_ = get(map);
        if (!map_) return;

        try {
            if (get(distanceMarkers) && !get(allHidden)) {
                let distanceSource: GeoJSONSource | undefined = map_.getSource('distance-markers');
                if (distanceSource) {
                    distanceSource.setData(this.getDistanceMarkersGeoJSON());
                } else {
                    map_.addSource('distance-markers', {
                        type: 'geojson',
                        data: this.getDistanceMarkersGeoJSON(),
                    });
                }
                if (!map_.getLayer('distance-markers')) {
                    map_.addLayer(
                        {
                            id: 'distance-markers',
                            type: 'symbol',
                            source: 'distance-markers',
                            filter: [
                                'match',
                                ['get', 'level'],
                                100,
                                ['>=', ['zoom'], 0],
                                50,
                                ['>=', ['zoom'], 7],
                                25,
                                [
                                    'any',
                                    ['all', ['>=', ['zoom'], 8], ['<=', ['zoom'], 9]],
                                    ['>=', ['zoom'], 11],
                                ],
                                10,
                                ['>=', ['zoom'], 10],
                                5,
                                ['>=', ['zoom'], 11],
                                1,
                                ['>=', ['zoom'], 13],
                                false,
                            ],
                            layout: {
                                'text-field': ['get', 'distance'],
                                'text-size': 14,
                                'text-font': ['Open Sans Bold'],
                            },
                            paint: {
                                'text-color': 'black',
                                'text-halo-width': 2,
                                'text-halo-color': 'white',
                            },
                        },
                        ANCHOR_LAYER_KEY.distanceMarkers
                    );
                }
            } else {
                if (map_.getLayer('distance-markers')) {
                    map_.removeLayer('distance-markers');
                }
            }
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
            return;
        }
    }

    remove() {
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    }

    getDistanceMarkersGeoJSON(): GeoJSON.FeatureCollection {
        let statistics = get(gpxStatistics);

        let features: GeoJSON.Feature[] = [];
        let currentTargetDistance = 1;
        statistics.forEachTrackPoint((trkpt, dist) => {
            if (dist >= getConvertedDistanceToKilometers(currentTargetDistance)) {
                let distance = currentTargetDistance.toFixed(0);
                let level = levels.find((level) => currentTargetDistance % level === 0) || 1;
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [trkpt.getLongitude(), trkpt.getLatitude()],
                    },
                    properties: {
                        distance,
                        level,
                    },
                } as GeoJSON.Feature);
                currentTargetDistance += 1;
            }
        });

        return {
            type: 'FeatureCollection',
            features,
        };
    }
}
