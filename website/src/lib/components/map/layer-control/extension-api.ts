import { settings } from '$lib/logic/settings';
import { derived, get, writable, type Writable } from 'svelte/store';
import { isSelected, remove, removeByPrefix, toggle } from './utils';
import { overlays, overlayTree } from '$lib/assets/layers';
import { browser } from '$app/environment';
import { map } from '$lib/components/map/map';

const { currentOverlays, previousOverlays, selectedOverlayTree } = settings;

export type CustomOverlay = {
    id: string;
    name: string;
    tileUrls: string[];
    maxZoom?: number;
};

export class ExtensionAPI {
    private _overlays: Writable<Map<string, CustomOverlay>> = writable(new Map());

    init() {
        if (browser && !window.hasOwnProperty('gpxstudio')) {
            Object.defineProperty(window, 'gpxstudio', {
                value: this,
            });
            addEventListener('beforeunload', () => {
                this.destroy();
            });
        }
    }

    ensureLoaded(): Promise<void> {
        return new Promise((resolve) => {
            map.onLoad(() => {
                resolve();
            });
        });
    }

    addOrUpdateOverlay(overlay: CustomOverlay) {
        if (!overlay.id || !overlay.tileUrls || overlay.tileUrls.length === 0) {
            throw new Error('Overlay must have an id and at least one tile URL.');
        }
        overlay.id = this.getOverlayId(overlay.id);

        this._overlays.update(($overlays) => {
            $overlays.set(overlay.id, overlay);
            return $overlays;
        });

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
                get(map)?.removeImport(overlay.id);
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

        currentOverlays.update((current) => {
            removeByPrefix(current, prefix);
            return current;
        });
        previousOverlays.update((previous) => {
            removeByPrefix(previous, prefix);
            return previous;
        });
        selectedOverlayTree.update((overlayTree) => {
            removeByPrefix(overlayTree, prefix);
            return overlayTree;
        });
        Object.keys(overlays).forEach((id) => {
            if (id.startsWith(prefix)) {
                delete overlays[id];
            }
        });
        removeByPrefix(overlayTree, prefix);
        this._overlays.update(($overlays) => {
            $overlays.forEach((_, id) => {
                if (id.startsWith(prefix)) {
                    $overlays.delete(id);
                }
            });
            return $overlays;
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

    isLayerFromExtension = derived(this._overlays, ($overlays) => {
        return (id: string) => $overlays.has(id);
    });

    getLayerName = derived(this._overlays, ($overlays) => {
        return (id: string) => $overlays.get(id)?.name || '';
    });

    private getOverlayId(id: string): string {
        return `extension-${id}`;
    }

    private destroy() {
        const ids = Array.from(get(this._overlays).keys());
        currentOverlays.update((overlays) => {
            ids.forEach((id) => {
                remove(overlays, id);
            });
            return overlays;
        });
        previousOverlays.update((overlays) => {
            ids.forEach((id) => {
                remove(overlays, id);
            });
            return overlays;
        });
        selectedOverlayTree.update((overlays) => {
            ids.forEach((id) => {
                remove(overlays, id);
            });
            return overlays;
        });
    }
}

export const extensionAPI = new ExtensionAPI();
