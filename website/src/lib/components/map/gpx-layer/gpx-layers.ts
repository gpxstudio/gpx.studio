import { GPXFileStateCollectionObserver } from '$lib/logic/file-state';
import { GPXLayer } from './gpx-layer';

export class GPXLayerCollection {
    private _layers: Map<string, GPXLayer>;
    private _fileStateCollectionObserver: GPXFileStateCollectionObserver | null = null;

    constructor() {
        this._layers = new Map<string, GPXLayer>();
    }

    init() {
        if (this._fileStateCollectionObserver) {
            return;
        }
        this._fileStateCollectionObserver = new GPXFileStateCollectionObserver(
            (newFiles) => {
                newFiles.forEach((fileState, fileId) => {
                    const layer = new GPXLayer(fileId, fileState);
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
}

export const gpxLayers = new GPXLayerCollection();
