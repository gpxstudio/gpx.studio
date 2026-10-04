import { FileStateCollectionObserver } from '$lib/engine';
import { writable } from 'svelte/store';
import { GPXLayer } from './gpx-layer';

export class GPXLayerCollection {
    private _layers: Map<string, GPXLayer>;
    private _fileStateCollectionObserver: FileStateCollectionObserver | null = null;

    constructor() {
        this._layers = new Map<string, GPXLayer>();
    }

    init() {
        if (this._fileStateCollectionObserver) {
            return;
        }
        this._fileStateCollectionObserver = new FileStateCollectionObserver(
            (newFiles) => {
                newFiles.forEach((fileStore, fileId) => {
                    const layer = new GPXLayer(fileId, fileStore);
                    this._layers.set(fileId, layer);
                });
            },
            (fileId) => {
                const layer = this._layers.get(fileId);
                if (layer) {
                    layer.remove();
                    this._layers.delete(fileId);
                }
            },
            () => {
                this._layers.forEach((layer) => {
                    layer.remove();
                });
                this._layers.clear();
            }
        );
    }

    getLayer(fileId: string): GPXLayer | undefined {
        return this._layers.get(fileId);
    }
}

export const gpxLayers = new GPXLayerCollection();
export const gpxColors = writable(new Map<string, string>());
