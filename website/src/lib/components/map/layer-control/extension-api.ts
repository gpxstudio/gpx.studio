import { settings } from '$lib/logic/settings';
import { derived, get, writable, type Writable } from 'svelte/store';
import { isSelected, remove, removeAll } from './utils';
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
        let unsubscribe: () => void;
        const promise = new Promise<void>((resolve) => {
            map.onLoad(() => {
                unsubscribe = currentOverlays.subscribe((current) => {
                    if (current) {
                        resolve();
                    }
                });
            });
        });
        promise.finally(() => {
            unsubscribe?.();
        });
        return promise;
    }

    addOrUpdateOverlay(overlay: CustomOverlay) {
        if (!overlay.id || !overlay.name || !overlay.tileUrls || overlay.tileUrls.length === 0) {
            throw new Error('Overlay must have an id, name, and at least one tile URL.');
        }
        overlay.id = this.getOverlayId(overlay.id);

        let show = get(this._overlays).get(overlay.id) === undefined;

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
            show = true;
            try {
                get(map)?.removeImport(overlay.id);
            } catch (e) {
                // No reliable way to check if the map is ready to remove sources and layers
            }
        }

        currentOverlays.update((current) => {
            current.overlays.world[overlay.id] = show;
            return current;
        });
    }

    filterOverlays(ids: string[]) {
        ids = ids.map((id) => this.getOverlayId(id));
        const idsToRemove = Array.from(get(this._overlays).keys()).filter(
            (id) => !ids.includes(id)
        );

        currentOverlays.update((current) => {
            removeAll(current, idsToRemove);
            return current;
        });
        previousOverlays.update((previous) => {
            removeAll(previous, idsToRemove);
            return previous;
        });
        selectedOverlayTree.update((selected) => {
            removeAll(selected, idsToRemove);
            return selected;
        });
        Object.keys(overlays).forEach((id) => {
            if (idsToRemove.includes(id)) {
                delete overlays[id];
            }
        });
        removeAll(overlayTree, idsToRemove);
        this._overlays.update(($overlays) => {
            $overlays.forEach((_, id) => {
                if (idsToRemove.includes(id)) {
                    $overlays.delete(id);
                }
            });
            return $overlays;
        });
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
        currentOverlays.update((current) => {
            ids.forEach((id) => {
                remove(current, id);
            });
            return current;
        });
        previousOverlays.update((previous) => {
            ids.forEach((id) => {
                remove(previous, id);
            });
            return previous;
        });
        selectedOverlayTree.update((selected) => {
            ids.forEach((id) => {
                remove(selected, id);
            });
            return selected;
        });
    }
}

export const extensionAPI = new ExtensionAPI();
