import { settings } from '$lib/state/settings';
import type { StyleSpecification } from 'maplibre-gl';
import { derived, get, writable, type Writable } from 'svelte/store';
import { isSelected, prefixStyle, removeAll } from './utils';
import { layerGroup, overlays, overlayTree, type LayerTreeType } from '$lib/data/layers';
import { browser } from '$app/environment';
import { map } from '$lib/components/map/map';

const { currentOverlays, previousOverlays, selectedOverlayTree } = settings;

/** An overlay of the v1 API. */
export type CustomOverlay = {
    extensionName: string;
    id: string;
    name: string;
    tileUrls: string[];
    maxZoom?: number;
};

/** An overlay of the v2 API. */
export type ExtensionOverlay = {
    /** Unique within the extension. Keep it stable: the opacity and menu choices are tied to it. */
    id: string;
    name: string;
    /**
     * The sources and layers of the overlay, or the URL of a style JSON (which must allow
     * cross-origin requests). It is used as is, with MapLibre's defaults: a `raster` source has
     * tiles of 512 pixels unless its `tileSize` says otherwise. Layers can only use the sources of
     * this style, and the rest of a style (`sprite`, `glyphs`, `terrain`...) is ignored.
     */
    style: StyleSpecification | string;
    /** Applied if given, otherwise the current state is kept (hidden for a new overlay). */
    visible?: boolean;
};

/** What the API knows of an overlay. */
type RegisteredOverlay = {
    extensionName: string;
    name: string;
    /** The style given by the extension, to tell when it changes; only for the v2 API. */
    signature?: string;
};

type VisibilityCallback = (visible: Record<string, boolean>) => void;

/** The groups of the overlay tree that an extension cannot put its overlays in. */
const reservedGroups = new Set(['__proto__', ...Object.keys(layerGroup(overlayTree.overlays))]);

/** The id of an overlay of the v1 API, whose methods do not all get the name of the extension. */
function getOverlayId(id: string): string {
    return `extension-${id}`;
}

/** The id of an overlay of the v2 API. It is encoded so that two extensions cannot clash. */
function getExtensionOverlayId(extensionName: string, id: string): string {
    return getOverlayId(`${encodeURIComponent(extensionName)}/${encodeURIComponent(id)}`);
}

/**
 * Sets the overlays of an extension in a tree, in order. Its other entries are dropped, except for
 * those of `keep`: its overlays of the v1 API, which can be in the same group. An extension that
 * has nothing left has no group anymore.
 */
function setGroup(
    tree: LayerTreeType,
    extensionName: string,
    entries: Record<string, boolean>,
    keep: (id: string) => boolean
) {
    const groups = layerGroup(tree.overlays);
    const group = groups[extensionName];
    const kept =
        typeof group === 'object'
            ? Object.entries(group).filter(([id]) => keep(id) && !Object.hasOwn(entries, id))
            : [];
    const updated = { ...entries, ...Object.fromEntries(kept) };
    if (Object.keys(updated).length > 0) {
        groups[extensionName] = updated;
    } else {
        delete groups[extensionName];
    }
    return tree;
}

export class ExtensionAPI {
    /** The version of the API; the methods of v1 are still there, until extensions have moved. */
    readonly version = 2;
    /**
     * Resolved once overlays can be set. `gpxstudio:extension-api-ready` is sent on `window` at that
     * moment.
     */
    ready!: Promise<void>;

    private _overlays: Writable<Map<string, RegisteredOverlay>> = writable(new Map());
    /** What each extension knows of the visibility of its overlays, by its own overlay ids. */
    private _visibility: Map<string, Record<string, boolean>> = new Map();
    private _visibilityCallbacks: Map<string, Set<VisibilityCallback>> = new Map();
    private _watchingVisibility = false;

    init() {
        if (browser && !Object.hasOwn(window, 'gpxstudio')) {
            this.ready = this.ensureLoaded();
            this.ready.then(() => window.dispatchEvent(new Event('gpxstudio:extension-api-ready')));
            Object.defineProperty(window, 'gpxstudio', {
                value: this,
            });
        }
    }

    /** @deprecated v1: use `ready`. */
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

    /**
     * Replaces the overlays of an extension: the order of the list is the order in the layer menu,
     * and the overlays that are not in the list are removed. The opacity and the choices of the
     * layer menu are kept for the ones that stay. Throws, changing nothing, if the list is invalid;
     * a style URL is only fetched when the overlay is shown, and a failure is then only logged.
     */
    setOverlays(extensionName: string, newOverlays: ExtensionOverlay[]) {
        if (typeof extensionName !== 'string' || !extensionName) {
            throw new Error('An extension must have a name.');
        }
        if (reservedGroups.has(extensionName)) {
            throw new Error(`The extension name ${extensionName} is reserved.`);
        }
        if (!Array.isArray(newOverlays)) {
            throw new Error('The overlays must be a list.');
        }
        const current = get(currentOverlays);
        if (!current) {
            throw new Error('Overlays cannot be set yet: wait for `gpxstudio.ready`.');
        }

        const previous = this.getOverlaysOf(extensionName);
        const next = new Map<string, RegisteredOverlay>();
        const styles = new Map<string, StyleSpecification | string>();
        for (const overlay of newOverlays) {
            if (!overlay?.id || !overlay.name || !overlay.style) {
                throw new Error('Overlay must have an id, a name and a style.');
            }
            const id = getExtensionOverlayId(extensionName, overlay.id);
            if (next.has(id)) {
                throw new Error(`Overlay ${overlay.id} is in the list twice.`);
            }
            const signature = JSON.stringify(overlay.style);
            // the ids of the style at a URL are prefixed when the map fetches it
            styles.set(
                id,
                typeof overlay.style === 'string'
                    ? overlay.style
                    : prefixStyle(id, JSON.parse(signature))
            );
            next.set(id, { extensionName, name: overlay.name, signature });
        }

        // Nothing can fail from here. The map does not replace a source that it already has, so
        // what has changed has to be removed first; it is then added back with the new style.
        const removedIds: string[] = [];
        previous.forEach((overlay, id) => {
            if (next.get(id)?.signature !== overlay.signature) {
                this.removeFromMap(id);
            }
            if (!next.has(id)) {
                removedIds.push(id);
                delete overlays[id];
            }
        });
        styles.forEach((style, id) => {
            overlays[id] = style;
        });
        this._overlays.update(($overlays) => {
            removedIds.forEach((id) => $overlays.delete(id));
            next.forEach((overlay, id) => $overlays.set(id, overlay));
            return $overlays;
        });

        const available: Record<string, boolean> = {};
        const selected: Record<string, boolean> = {};
        const shown: Record<string, boolean> = {};
        const visibility: Record<string, boolean> = {};
        const selectedGroup = layerGroup(get(selectedOverlayTree).overlays)[extensionName];
        newOverlays.forEach((overlay) => {
            const id = getExtensionOverlayId(extensionName, overlay.id);
            available[id] = true;
            // an overlay that the user took out of the layer menu could not be hidden again
            selected[id] =
                typeof selectedGroup !== 'object' ||
                !Object.hasOwn(selectedGroup, id) ||
                selectedGroup[id] === true;
            shown[id] = selected[id] && Boolean(overlay.visible ?? isSelected(current, id));
            visibility[overlay.id] = shown[id];
        });

        const keep = (id: string) => {
            const overlay = get(this._overlays).get(id);
            return overlay !== undefined && overlay.signature === undefined;
        };
        setGroup(overlayTree, extensionName, available, keep);
        selectedOverlayTree.update((tree) => setGroup(tree, extensionName, selected, keep));
        previousOverlays.update((tree) => removeAll(tree, removedIds));
        // this is not an action of the user: there must be nothing to tell the extension about
        this._visibility.set(extensionName, visibility);
        currentOverlays.update((tree) => setGroup(tree, extensionName, shown, keep));
    }

    /**
     * Calls `callback` with the visibility of all the overlays of the extension, by id, when the
     * user shows or hides one of them (not when `setOverlays` does). Returns how to stop.
     */
    onVisibilityChange(extensionName: string, callback: VisibilityCallback): () => void {
        const callbacks = this._visibilityCallbacks.get(extensionName) ?? new Set();
        this._visibilityCallbacks.set(extensionName, callbacks);
        callbacks.add(callback);
        if (!this._watchingVisibility) {
            this._watchingVisibility = true;
            currentOverlays.subscribe(() => this.notifyVisibility());
        }
        return () => {
            callbacks.delete(callback);
        };
    }

    private notifyVisibility() {
        const current = get(currentOverlays);
        if (!current) return;
        this._visibilityCallbacks.forEach((callbacks, extensionName) => {
            const known = this._visibility.get(extensionName);
            if (!known) return;
            const visibility = Object.fromEntries(
                Object.keys(known).map((id) => [
                    id,
                    isSelected(current, getExtensionOverlayId(extensionName, id)),
                ])
            );
            if (Object.keys(known).every((id) => known[id] === visibility[id])) return;
            this._visibility.set(extensionName, visibility);
            callbacks.forEach((callback) => {
                try {
                    callback({ ...visibility });
                } catch (e) {
                    // an extension must not break the updates of the store for the others
                    console.error(e);
                }
            });
        });
    }

    private getOverlaysOf(extensionName: string): Map<string, RegisteredOverlay> {
        return new Map(
            Array.from(get(this._overlays)).filter(
                ([, overlay]) =>
                    overlay.extensionName === extensionName && overlay.signature !== undefined
            )
        );
    }

    /** Removes the layers and sources of an overlay: their ids start with the one of the overlay. */
    private removeFromMap(overlayId: string) {
        const map_ = get(map);
        if (!map_) return;
        try {
            const style = map_.getStyle();
            style.layers
                .filter((layer) => layer.id.startsWith(`${overlayId}/`))
                .forEach((layer) => map_.removeLayer(layer.id));
            Object.keys(style.sources)
                .filter((source) => source.startsWith(`${overlayId}/`))
                .forEach((source) => map_.removeSource(source));
        } catch {
            // No reliable way to check if the map is ready to remove sources and layers
        }
    }

    /** @deprecated v1: use `setOverlays`. */
    addOrUpdateOverlay(overlay: CustomOverlay) {
        if (
            !overlay.extensionName ||
            !overlay.id ||
            !overlay.name ||
            !overlay.tileUrls ||
            overlay.tileUrls.length === 0
        ) {
            throw new Error(
                'Overlay must have an extensionName, id, name, and at least one tile URL.'
            );
        }
        overlay.id = getOverlayId(overlay.id);

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

        const extensions = layerGroup(overlayTree.overlays);
        if (!Object.hasOwn(extensions, overlay.extensionName)) {
            extensions[overlay.extensionName] = {};
        }

        layerGroup(extensions[overlay.extensionName])[overlay.id] = true;

        selectedOverlayTree.update((selected) => {
            if (!Object.hasOwn(selected.overlays, overlay.extensionName)) {
                selected.overlays[overlay.extensionName] = {};
            }
            selected.overlays[overlay.extensionName][overlay.id] = true;
            return selected;
        });

        const current = get(currentOverlays);
        let show = false;
        if (current && isSelected(current, overlay.id)) {
            show = true;
            try {
                get(map)?.removeLayer(overlay.id);
            } catch {
                // No reliable way to check if the map is ready to remove sources and layers
            }
        }

        currentOverlays.update((current) => {
            if (!Object.hasOwn(current.overlays, overlay.extensionName)) {
                current.overlays[overlay.extensionName] = {};
            }
            current.overlays[overlay.extensionName][overlay.id] = show;
            return current;
        });
    }

    /** @deprecated v1: use `setOverlays`. Leaves the overlays of the v2 API alone. */
    filterOverlays(ids: string[]) {
        ids = ids.map((id) => getOverlayId(id));
        const idsToRemove = Array.from(get(this._overlays))
            .filter(([id, overlay]) => overlay.signature === undefined && !ids.includes(id))
            .map(([id]) => id);

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

    /** @deprecated v1: use `setOverlays`. */
    updateOverlaysOrder(ids: string[]) {
        ids = ids.map((id) => getOverlayId(id));
        selectedOverlayTree.update((selected) => {
            const isSelected: Record<string, boolean> = {};
            ids.forEach((id) => {
                const overlay = get(this._overlays).get(id);
                if (
                    overlay &&
                    Object.hasOwn(selected.overlays, overlay.extensionName) &&
                    Object.hasOwn(selected.overlays[overlay.extensionName] as LayerTreeType, id)
                ) {
                    isSelected[id] = selected.overlays[overlay.extensionName][id];
                    delete selected.overlays[overlay.extensionName][id];
                }
            });
            Object.entries(isSelected).forEach(([id, value]) => {
                const overlay = get(this._overlays).get(id)!;
                selected.overlays[overlay.extensionName][id] = value;
            });
            return selected;
        });
    }

    isLayerFromExtension = derived(this._overlays, ($overlays) => {
        return (id: string) => $overlays.has(id);
    });

    getLayerName = derived(this._overlays, ($overlays) => {
        return (id: string) => $overlays.get(id)?.name || '';
    });

    /** Whether a group of the layer trees is an extension, whose name is shown as it was given. */
    isExtensionGroup = derived(this._overlays, ($overlays) => {
        const names = new Set(Array.from($overlays.values(), (overlay) => overlay.extensionName));
        return (id: string) => names.has(id);
    });
}

export const extensionAPI = new ExtensionAPI();
