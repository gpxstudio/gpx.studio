import { TrackPoint, Waypoint } from "gpx";
import mapboxgl from "mapbox-gl";
import { tick } from "svelte";
import { get, writable, type Writable } from "svelte/store";
import MapPopupComponent from "./MapPopup.svelte";

export type PopupItem<T = Waypoint | TrackPoint | any> = {
    item: T;
    fileId?: string;
    hide?: () => void;
};

export class MapPopup {
    map: mapboxgl.Map;
    popup: mapboxgl.Popup;
    item: Writable<PopupItem | null> = writable(null);
    maybeHideBinded = this.maybeHide.bind(this);

    constructor(map: mapboxgl.Map, options?: mapboxgl.PopupOptions) {
        this.map = map;
        this.popup = new mapboxgl.Popup(options);

        let component = new MapPopupComponent({
            target: document.body,
            props: {
                item: this.item
            }
        });

        tick().then(() => this.popup.setDOMContent(component.container));
    }

    setItem(item: PopupItem | null) {
        if (item)
            item.hide = () => this.hide();
        this.item.set(item);
        if (item === null) {
            this.hide();
        } else {
            tick().then(() => this.show());
        }
    }

    show() {
        const i = get(this.item);
        if (i === null) {
            this.hide();
            return;
        }
        this.popup.setLngLat(this.getCoordinates()).addTo(this.map);
        this.map.on('mousemove', this.maybeHideBinded);
    }

    maybeHide(e: mapboxgl.MapMouseEvent) {
        const i = get(this.item);
        if (i === null) {
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
    }

    getCoordinates() {
        const i = get(this.item);
        if (i === null) {
            return new mapboxgl.LngLat(0, 0);
        }
        return (i.item instanceof Waypoint || i.item instanceof TrackPoint) ? i.item.getCoordinates() : new mapboxgl.LngLat(i.item.lon, i.item.lat);
    }
}