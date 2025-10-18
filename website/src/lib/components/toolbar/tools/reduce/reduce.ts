import { ListItem, ListTrackSegmentItem } from '$lib/components/file-list/file-list';
import { map } from '$lib/components/map/map';
import { fileActions } from '$lib/logic/file-actions';
import { GPXFileStateCollectionObserver, type GPXFileState } from '$lib/logic/file-state';
import { selection } from '$lib/logic/selection';
import { ramerDouglasPeucker, TrackPoint, type SimplifiedTrackPoint } from 'gpx';
import type { GeoJSONSource } from 'mapbox-gl';
import { get, writable } from 'svelte/store';

export const minTolerance = 0.1;

export class ReducedGPXLayer {
    private _fileState: GPXFileState;
    private _updateSimplified: (
        itemId: string,
        data: [ListItem, number, SimplifiedTrackPoint[]]
    ) => void;
    private _unsubscribes: (() => void)[] = [];

    constructor(
        fileState: GPXFileState,
        updateSimplified: (itemId: string, data: [ListItem, number, SimplifiedTrackPoint[]]) => void
    ) {
        this._fileState = fileState;
        this._updateSimplified = updateSimplified;
        this._unsubscribes.push(this._fileState.subscribe(() => this.update()));
    }

    update() {
        const file = this._fileState.file;
        const stats = this._fileState.statistics;
        if (!file || !stats) {
            return;
        }
        file.forEachSegment((segment, trackIndex, segmentIndex) => {
            let segmentItem = new ListTrackSegmentItem(file._data.id, trackIndex, segmentIndex);
            let statistics = stats.getStatisticsFor(segmentItem);
            this._updateSimplified(segmentItem.getFullId(), [
                segmentItem,
                statistics.local.points.length,
                ramerDouglasPeucker(statistics.local.points, minTolerance),
            ]);
        });
    }

    destroy() {
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());
    }
}

export const tolerance = writable<number>(0);

export class ReducedGPXLayerCollection {
    private _layers: Map<string, ReducedGPXLayer> = new Map();
    private _simplified: Map<string, [ListItem, number, SimplifiedTrackPoint[]]>;
    private _fileStateCollectionOberver: GPXFileStateCollectionObserver;
    private _updateSimplified = this.updateSimplified.bind(this);
    private _unsubscribes: (() => void)[] = [];

    constructor() {
        this._layers = new Map();
        this._simplified = new Map();
        this._fileStateCollectionOberver = new GPXFileStateCollectionObserver(
            (fileId, fileState) => {
                this._layers.set(fileId, new ReducedGPXLayer(fileState, this._updateSimplified));
            },
            (fileId) => {
                this._layers.get(fileId)?.destroy();
                this._layers.delete(fileId);
            },
            () => {
                this._layers.forEach((layer) => layer.destroy());
                this._layers.clear();
            }
        );
        this._unsubscribes.push(selection.subscribe(() => this.update()));
        this._unsubscribes.push(tolerance.subscribe(() => this.update()));
    }

    updateSimplified(itemId: string, data: [ListItem, number, SimplifiedTrackPoint[]]) {
        this._simplified.set(itemId, data);
        if (get(selection).hasAnyParent(data[0])) {
            this.update();
        }
    }

    removeSimplified(itemId: string) {
        if (this._simplified.delete(itemId)) {
            this.update();
        }
    }

    update() {
        let maxPoints = 0;
        let currentPoints = 0;

        let data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };

        this._simplified.forEach(([item, maxPts, points], itemFullId) => {
            if (!get(selection).hasAnyParent(item)) {
                return;
            }

            maxPoints += maxPts;

            let current = points.filter(
                (point) => point.distance === undefined || point.distance >= get(tolerance)
            );
            currentPoints += current.length;

            data.features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: current.map((point) => [
                        point.point.getLongitude(),
                        point.point.getLatitude(),
                    ]),
                },
                properties: {},
            });
        });

        const map_ = get(map);
        if (!map_) {
            return;
        }

        let source: GeoJSONSource | undefined = map_.getSource('simplified');
        if (source) {
            source.setData(data);
        } else {
            map_.addSource('simplified', {
                type: 'geojson',
                data: data,
            });
        }
        if (!map_.getLayer('simplified')) {
            map_.addLayer({
                id: 'simplified',
                type: 'line',
                source: 'simplified',
                paint: {
                    'line-color': 'white',
                    'line-width': 3,
                },
            });
        } else {
            map_.moveLayer('simplified');
        }
    }

    reduce() {
        let itemsAndPoints = new Map<ListItem, TrackPoint[]>();
        this._simplified.forEach(([item, maxPts, points], itemFullId) => {
            itemsAndPoints.set(
                item,
                points
                    .filter(
                        (point) => point.distance === undefined || point.distance >= get(tolerance)
                    )
                    .map((point) => point.point)
            );
        });
        fileActions.reduce(itemsAndPoints);
    }

    destroy() {
        this._fileStateCollectionOberver.destroy();
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());

        const map_ = get(map);
        if (!map_) {
            return;
        }

        if (map_.getLayer('simplified')) {
            map_.removeLayer('simplified');
        }
        if (map_.getSource('simplified')) {
            map_.removeSource('simplified');
        }
    }
}
