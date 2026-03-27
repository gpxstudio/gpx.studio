import { get } from 'svelte/store';
import { selection } from '$lib/logic/selection';
import maplibregl from 'maplibre-gl';
import { ListFileItem, ListWaypointItem } from '$lib/components/file-list/file-list';
import { fileStateCollection, GPXFileStateCollectionObserver } from '$lib/logic/file-state';
import { gpxStatistics } from '$lib/logic/statistics';
import { map } from '$lib/components/map/map';
import type { GPXFileWithStatistics } from './statistics-tree';
import type { Coordinates } from 'gpx';
import { page } from '$app/state';

export class BoundsManager {
    private _bounds: maplibregl.LngLatBounds = new maplibregl.LngLatBounds();
    private _files: Set<string> = new Set();
    private _fileStateCollectionObserver: GPXFileStateCollectionObserver | null = null;
    private _unsubscribes: (() => void)[] = [];

    constructor() {
        this._fileStateCollectionObserver = new GPXFileStateCollectionObserver(
            (newFiles) => {
                if (page.url.hash.length == 0) {
                    this.fitBoundsOnLoad(Array.from(newFiles.keys()));
                }
            },
            (fileId) => {},
            () => {}
        );
    }

    fitBoundsOnLoad(files: string[]) {
        this.reset();

        this._files = new Set(files);
        this._fileStateCollectionObserver = new GPXFileStateCollectionObserver(
            (newFiles) => {
                newFiles.forEach((fileState, fileId) => {
                    if (this._files.has(fileId)) {
                        this._unsubscribes.push(
                            fileState.subscribe((state) => {
                                this.addBoundsFromFile(fileId, state);
                            })
                        );
                    }
                });
            },
            (fileId) => {},
            () => {}
        );
    }

    addBoundsFromFile(fileId: string, file: GPXFileWithStatistics | undefined) {
        if (!file || !this._files.has(fileId)) return;

        this._files.delete(fileId);

        const bounds = file.statistics.getStatisticsFor(new ListFileItem(fileId)).global.bounds;
        if (!this.validBounds(bounds)) return;

        this._bounds.extend(bounds.southWest);
        this._bounds.extend(bounds.northEast);

        if (this._files.size === 0) {
            this.finalizeFitBounds();
        }
    }

    finalizeFitBounds() {
        if (
            this._bounds.getSouth() >= this._bounds.getNorth() &&
            this._bounds.getWest() >= this._bounds.getEast()
        ) {
            return;
        }

        this._unsubscribes.push(
            map.subscribe((map_) => {
                if (!map_) return;
                map_.fitBounds(this._bounds, { padding: 80, linear: true, easing: () => 1 });
                this.reset();
            })
        );
    }

    reset() {
        if (this._fileStateCollectionObserver) {
            this._fileStateCollectionObserver.destroy();
        }
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());
        this._unsubscribes = [];
        this._bounds = new maplibregl.LngLatBounds([180, 90, -180, -90]);
    }

    centerMapOnSelection() {
        let selected = get(selection).getSelected();
        let bounds = new maplibregl.LngLatBounds();

        if (selected.find((item) => item instanceof ListWaypointItem)) {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = fileStateCollection.getFile(fileId);
                if (file) {
                    items.forEach((item) => {
                        if (item instanceof ListWaypointItem) {
                            let waypoint = file.wpt[item.getWaypointIndex()];
                            if (waypoint) {
                                bounds.extend([waypoint.getLongitude(), waypoint.getLatitude()]);
                            }
                        }
                    });
                }
            });
        } else {
            let selectionBounds = get(gpxStatistics).global.bounds;
            bounds.setNorthEast(selectionBounds.northEast);
            bounds.setSouthWest(selectionBounds.southWest);
        }

        get(map)?.fitBounds(bounds, {
            padding: 80,
            easing: () => 1,
            maxZoom: 15,
        });
    }

    validBounds(bounds: { southWest: Coordinates; northEast: Coordinates }) {
        return (
            bounds.southWest.lat !== 90 ||
            bounds.southWest.lon !== 180 ||
            bounds.northEast.lat !== -90 ||
            bounds.northEast.lon !== -180
        );
    }
}

export const boundsManager = new BoundsManager();
