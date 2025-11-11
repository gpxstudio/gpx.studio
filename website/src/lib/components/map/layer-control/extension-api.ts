import { map, type MapboxGLMap } from '$lib/components/map/map';
import { settings } from '$lib/logic/settings';
import { get } from 'svelte/store';
import { isSelected, remove, removeByPrefix, toggle } from './utils';
import { overlays, overlayTree } from '$lib/assets/layers';
import { browser } from '$app/environment';

const { currentOverlays, previousOverlays, selectedOverlayTree } = settings;

export type CustomOverlay = {
    id: string;
    name: string;
    tileUrls: string[];
    maxZoom?: number;
};

export class ExtensionAPI {
    private _map: MapboxGLMap;
    private _overlays: Map<string, CustomOverlay> = new Map();

    constructor(map: MapboxGLMap) {
        this._map = map;
        if (browser && !window.hasOwnProperty('gpxstudio')) {
            Object.defineProperty(window, 'gpxstudio', {
                value: this,
            });
            addEventListener('beforeunload', () => {
                this.destroy();
            });
        }
    }

    async ensureLoaded(): Promise<void> {
        return new Promise((resolve) => {
            this._map.onLoad(() => {
                resolve();
            });
        });
    }

    addOrUpdateOverlay(overlay: CustomOverlay) {
        if (!overlay.id || !overlay.tileUrls || overlay.tileUrls.length === 0) {
            throw new Error('Overlay must have an id and at least one tile URL.');
        }
        overlay.id = this.getOverlayId(overlay.id);

        this._overlays.set(overlay.id, overlay);

        overlays[overlay.id] = {
            version: 8,
            sources: {
                [overlay.id]: {
                    type: 'raster',
                    tiles: overlay.tileUrls,
                    tileSize: overlay.tileUrls.some((url) => url.includes('512')) ? 512 : 256,
                    maxzoom: overlay.maxZoom ?? 22,
                },
            },
            layers: [
                {
                    id: overlay.id,
                    type: 'raster',
                    source: overlay.id,
                },
            ],
        };

        overlayTree.overlays.world[overlay.id] = true;

        selectedOverlayTree.update((selected) => {
            selected.overlays.world[overlay.id] = true;
            return selected;
        });

        const current = get(currentOverlays);
        if (current && isSelected(current, overlay.id)) {
            try {
                get(this._map)?.removeImport(overlay.id);
            } catch (e) {
                // No reliable way to check if the map is ready to remove sources and layers
            }
        }

        currentOverlays.update((current) => {
            current.overlays.world[overlay.id] = true;
            return current;
        });
    }

    removeOverlaysWithPrefix(prefix: string) {
        prefix = this.getOverlayId(prefix);

        currentOverlays.update((overlays) => {
            removeByPrefix(overlays, prefix);
            return overlays;
        });
        previousOverlays.update((overlays) => {
            removeByPrefix(overlays, prefix);
            return overlays;
        });
        selectedOverlayTree.update((overlays) => {
            removeByPrefix(overlays, prefix);
            return overlays;
        });
        Object.keys(overlays).forEach((id) => {
            if (id.startsWith(prefix)) {
                delete overlays[id];
            }
        });
        Object.keys(overlayTree.overlays.world).forEach((id) => {
            if (id.startsWith(prefix)) {
                delete overlayTree.overlays.world[id];
            }
        });
    }

    toggleOverlay(id: string) {
        id = this.getOverlayId(id);

        currentOverlays.update((overlays) => {
            toggle(overlays, id);
            return overlays;
        });
        if (!isSelected(get(selectedOverlayTree), id)) {
            selectedOverlayTree.update((overlays) => {
                toggle(overlays, id);
                return overlays;
            });
        }
    }

    isLayerFromExtension(id: string): boolean {
        return this._overlays.has(id);
    }

    getLayerName(id: string): string {
        const overlay = this._overlays.get(id);
        return overlay ? overlay.name : '';
    }

    private getOverlayId(id: string): string {
        return `extension-${id}`;
    }

    private destroy() {
        currentOverlays.update((overlays) => {
            this._overlays.forEach((_, id) => {
                remove(overlays, id);
            });
            return overlays;
        });
        previousOverlays.update((overlays) => {
            this._overlays.forEach((_, id) => {
                remove(overlays, id);
            });
            return overlays;
        });
        selectedOverlayTree.update((overlays) => {
            this._overlays.forEach((_, id) => {
                remove(overlays, id);
            });
            return overlays;
        });
    }
}

export const extensionAPI = new ExtensionAPI(map);
