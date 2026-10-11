import { get } from 'svelte/store';
import maplibregl from 'maplibre-gl';
import { map } from '$lib/components/map/map';
import { page } from '$app/state';
import { engine, FileStateCollectionObserver, type FileState } from '$lib/engine';

const { statistics } = engine;

export class BoundsManager {
    private _bounds: maplibregl.LngLatBounds = new maplibregl.LngLatBounds();
    private _files: Set<string> = new Set();
    private _fileStateCollectionObserver: FileStateCollectionObserver | null = null;
    private _unsubscribes: (() => void)[] = [];

    constructor() {
        this._fileStateCollectionObserver = new FileStateCollectionObserver(
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
        this._fileStateCollectionObserver = new FileStateCollectionObserver(
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

    addBoundsFromFile(fileId: string, file: FileState) {
        if (!file || !this._files.has(fileId)) return;

        this._files.delete(fileId);

        if (file.statistics.bounds) {
            let bounds = new maplibregl.LngLatBounds([
                file.statistics.bounds.west,
                file.statistics.bounds.south,
                file.statistics.bounds.east,
                file.statistics.bounds.north,
            ]);
            if (!this.validBounds(bounds)) return;
            this._bounds.extend(bounds);
        }

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
                map_.fitBounds(this._bounds, { padding: 80, linear: true, animate: false });
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
        const bounds = new maplibregl.LngLatBounds([180, 90, -180, -90]);
        const stats = get(statistics);
        if (stats.global.bounds) {
            bounds.extend([
                [stats.global.bounds.west, stats.global.bounds.south],
                [stats.global.bounds.east, stats.global.bounds.north],
            ]);
        }

        // the waypoints are not part of the statistics of the selection
        const selection = get(engine.selection);
        let waypointIds: Set<string> | undefined; // all the waypoints of the file if undefined
        let fileIds: string[] = [];
        switch (selection.type) {
            case 'file':
                fileIds = selection.fileIds;
                break;
            case 'waypoints':
                fileIds = [selection.fileId];
                break;
            case 'waypoint':
                fileIds = [selection.fileId];
                waypointIds = new Set(selection.waypointIds);
                break;
        }
        const files = get(engine.files);
        for (const fileId of fileIds) {
            const file = files.get(fileId);
            if (!file) continue;
            for (const feature of get(file).waypoints.features) {
                if (waypointIds && !waypointIds.has(feature.properties.waypointId)) continue;
                bounds.extend(feature.geometry.coordinates as [number, number]);
            }
        }

        if (!this.validBounds(bounds)) return;
        get(map)?.fitBounds(bounds, {
            padding: 80,
            easing: () => 1,
            maxZoom: 15,
        });
    }

    validBounds(bounds: maplibregl.LngLatBounds) {
        return (
            bounds.getSouthWest().lat !== 90 ||
            bounds.getSouthWest().lng !== 180 ||
            bounds.getNorthEast().lat !== -90 ||
            bounds.getNorthEast().lng !== -180
        );
    }
}

export const boundsManager = new BoundsManager();
