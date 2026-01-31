import { ListTrackSegmentItem } from '$lib/components/file-list/file-list';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { splitAs } from '$lib/components/toolbar/tools/scissors/scissors';
import { Scissors } from 'lucide-static';
import { selection } from '$lib/logic/selection';
import { gpxStatistics } from '$lib/logic/statistics';
import { get } from 'svelte/store';
import { fileStateCollection } from '$lib/logic/file-state';
import { fileActions } from '$lib/logic/file-actions';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import type { GeoJSONSource } from 'maplibre-gl';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import type { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';

export class SplitControls {
    map: maplibregl.Map;
    layerEventManager: MapLayerEventManager;
    unsubscribes: Function[] = [];

    layerOnMouseEnterBinded: (e: any) => void = this.layerOnMouseEnter.bind(this);
    layerOnMouseLeaveBinded: () => void = this.layerOnMouseLeave.bind(this);
    layerOnClickBinded: (e: any) => void = this.layerOnClick.bind(this);

    constructor(map: maplibregl.Map, layerEventManager: MapLayerEventManager) {
        this.map = map;
        this.layerEventManager = layerEventManager;

        if (!this.map.hasImage('split-control')) {
            let icon = new Image(100, 100);
            icon.onload = () => {
                if (!this.map.hasImage('split-control')) {
                    this.map.addImage('split-control', icon);
                }
            };

            // Lucide icons are SVG files with a 24x24 viewBox
            // Create a new SVG with a 32x32 viewBox and center the icon in a circle
            icon.src =
                'data:image/svg+xml,' +
                encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="20" fill="white" />
                            <g transform="translate(8 8)">
                            ${Scissors.replace('stroke="currentColor"', 'stroke="black"')}
                            </g>
                        </svg>
                    `);
        }

        this.unsubscribes.push(gpxStatistics.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(currentTool.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(selection.subscribe(this.addIfNeeded.bind(this)));
    }

    addIfNeeded() {
        let scissors = get(currentTool) === Tool.SCISSORS;
        if (!scissors) {
            this.remove();
            return;
        }

        this.updateControls();
    }

    updateControls() {
        let data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };
        selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let file = fileStateCollection.getFile(fileId);

            if (file) {
                file.forEachSegment((segment, trackIndex, segmentIndex) => {
                    if (
                        get(selection).hasAnyParent(
                            new ListTrackSegmentItem(fileId, trackIndex, segmentIndex)
                        )
                    ) {
                        for (let i = 1; i < segment.trkpt.length - 1; i++) {
                            let point = segment.trkpt[i];
                            if (point._data.anchor) {
                                data.features.push({
                                    type: 'Feature',
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [point.getLongitude(), point.getLatitude()],
                                    },
                                    properties: {
                                        fileId: fileId,
                                        trackIndex: trackIndex,
                                        segmentIndex: segmentIndex,
                                        pointIndex: i,
                                        minZoom: point._data.zoom,
                                    },
                                });
                            }
                        }
                    }
                });
            }
        }, false);

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
        let coordinates = (e.features![0].geometry as GeoJSON.Point).coordinates;
        fileActions.split(
            get(splitAs),
            e.features![0].properties!.fileId,
            e.features![0].properties!.trackIndex,
            e.features![0].properties!.segmentIndex,
            { lon: coordinates[0], lat: coordinates[1] },
            e.features![0].properties!.pointIndex
        );
    }

    destroy() {
        this.remove();
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    }
}
