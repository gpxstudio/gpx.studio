import { TrackPoint, Waypoint } from 'gpx';
import maplibregl from 'maplibre-gl';
import { mount, tick, unmount } from 'svelte';
import { get, writable, type Writable } from 'svelte/store';
import MapPopupComponent from '$lib/components/map/MapPopup.svelte';

export type PopupItem<T = Waypoint | TrackPoint | any> = {
    item: T;
    fileId?: string;
    hide?: () => void;
};

export class MapPopup {
    map: maplibregl.Map;
    popup: maplibregl.Popup;
    item: Writable<PopupItem | null> = writable(null);
    component: ReturnType<typeof mount>;
    maybeHideBinded = this.maybeHide.bind(this);

    constructor(map: maplibregl.Map, options?: maplibregl.PopupOptions) {
        this.map = map;
        this.popup = new maplibregl.Popup(options);
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

    maybeHide(e: maplibregl.MapMouseEvent) {
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
            return new maplibregl.LngLat(0, 0);
        }
        return item.item instanceof Waypoint || item.item instanceof TrackPoint
            ? item.item.getCoordinates()
            : new maplibregl.LngLat(item.item.lon, item.item.lat);
    }
}
