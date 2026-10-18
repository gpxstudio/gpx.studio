import { LngLat, type Map, type MapMouseEvent, Popup, type PopupOptions } from 'maplibre-gl';
import { mount, tick, unmount } from 'svelte';
import { get, writable, type Writable } from 'svelte/store';
import MapPopupComponent from '$lib/components/map/MapPopup.svelte';

export type PopupItem<T = any> = {
    /** Has a position (`lng` and `lat`). */
    item: T;
    /** What the item is: a `WaypointDetails`, a `TrackpointDetails` or an Overpass element. */
    kind: 'waypoint' | 'trackpoint' | 'overpass';
    fileId?: string;
    hide?: () => void;
};

export class MapPopup {
    map: Map;
    popup: Popup;
    item: Writable<PopupItem | null> = writable(null);
    component: ReturnType<typeof mount>;
    maybeHideBinded = this.maybeHide.bind(this);

    constructor(map: Map, options?: PopupOptions) {
        this.map = map;
        this.popup = new Popup(options);
        this.component = mount(MapPopupComponent, {
            target: document.body,
            props: {
                item: this.item,
                onContainerReady: (container: HTMLDivElement) => {
                    this.popup.setDOMContent(container);
                },
            },
        });
    }

    setItem(item: PopupItem | null) {
        if (item) item.hide = () => this.hide();
        this.item.set(item);
        if (item === null) {
            this.hide();
        } else {
            tick().then(() => this.show());
        }
    }

    show() {
        const item = get(this.item);
        if (item === null) {
            this.hide();
            return;
        }
        this.popup.setLngLat(this.getCoordinates()).addTo(this.map);
        this.map.on('mousemove', this.maybeHideBinded);
    }

    maybeHide(e: MapMouseEvent) {
        const item = get(this.item);
        if (item === null) {
            this.hide();
            return;
        }
        if (this.map.project(this.getCoordinates()).dist(this.map.project(e.lngLat)) > 60) {
            this.hide();
        }
    }

    hide() {
        this.popup.remove();
        this.map.off('mousemove', this.maybeHideBinded);
    }

    remove() {
        this.popup.remove();
        unmount(this.component);
    }

    getCoordinates() {
        const item = get(this.item);
        if (item === null) {
            return new LngLat(0, 0);
        }
        return new LngLat(item.item.lng, item.item.lat);
    }
}
