import mapboxgl, { type LayerSpecification, type VectorSourceSpecification } from "mapbox-gl";
import { Viewer, type ViewerBearingEvent } from 'mapillary-js/dist/mapillary.module';
import 'mapillary-js/dist/mapillary.css';
import { resetCursor, setPointerCursor } from "$lib/utils";
import type { Writable } from "svelte/store";

const mapillarySource: VectorSourceSpecification = {
    type: 'vector',
    tiles: ['https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/{z}/{x}/{y}?access_token=MLY|4381405525255083|3204871ec181638c3c31320490f03011'],
    minzoom: 6,
    maxzoom: 14,
};

const mapillarySequenceLayer: LayerSpecification = {
    id: 'mapillary-sequence',
    type: 'line',
    source: 'mapillary',
    'source-layer': 'sequence',
    paint: {
        'line-color': 'rgb(0, 150, 70)',
        'line-opacity': 0.7,
        'line-width': 5,
    },
    layout: {
        'line-cap': 'round',
        'line-join': 'round',
    },
};

const mapillaryImageLayer: LayerSpecification = {
    id: 'mapillary-image',
    type: 'circle',
    source: 'mapillary',
    'source-layer': 'image',
    paint: {
        'circle-color': 'rgb(0, 150, 70)',
        'circle-radius': 5,
        'circle-opacity': 0.7,
    },
};

export class MapillaryLayer {
    map: mapboxgl.Map;
    marker: mapboxgl.Marker;
    viewer: Viewer;

    active = false;
    popupOpen: Writable<boolean>;

    addBinded = this.add.bind(this);
    onMouseEnterBinded = this.onMouseEnter.bind(this);
    onMouseLeaveBinded = this.onMouseLeave.bind(this);

    constructor(map: mapboxgl.Map, container: HTMLElement, popupOpen: Writable<boolean>) {
        this.map = map;

        this.viewer = new Viewer({
            accessToken: 'MLY|4381405525255083|3204871ec181638c3c31320490f03011',
            container,
        });

        const element = document.createElement('div');
        element.className = 'mapboxgl-user-location mapboxgl-user-location-show-heading';
        const dot = document.createElement('div');
        dot.className = 'mapboxgl-user-location-dot';
        const heading = document.createElement('div');
        heading.className = 'mapboxgl-user-location-heading';
        element.appendChild(dot);
        element.appendChild(heading);

        this.marker = new mapboxgl.Marker({
            rotationAlignment: 'map',
            element
        });

        this.viewer.on('position', async () => {
            if (this.active) {
                popupOpen.set(true);
                let latLng = await this.viewer.getPosition();
                this.marker.setLngLat(latLng).addTo(this.map);
                if (!this.map.getBounds()?.contains(latLng)) {
                    this.map.panTo(latLng);
                }
            }
        });

        this.viewer.on('bearing', (e: ViewerBearingEvent) => {
            if (this.active) {
                this.marker.setRotation(e.bearing);
            }
        });

        this.popupOpen = popupOpen;
    }

    add() {
        if (!this.map.getSource('mapillary')) {
            this.map.addSource('mapillary', mapillarySource);
        }
        if (!this.map.getLayer('mapillary-sequence')) {
            this.map.addLayer(mapillarySequenceLayer);
        }
        if (!this.map.getLayer('mapillary-image')) {
            this.map.addLayer(mapillaryImageLayer);
        }
        this.map.on('style.load', this.addBinded);
        this.map.on('mouseenter', 'mapillary-image', this.onMouseEnterBinded);
        this.map.on('mouseleave', 'mapillary-image', this.onMouseLeaveBinded);
    }

    remove() {
        this.map.off('style.load', this.addBinded);
        this.map.off('mouseenter', 'mapillary-image', this.onMouseEnterBinded);
        this.map.off('mouseleave', 'mapillary-image', this.onMouseLeaveBinded);

        if (this.map.getLayer('mapillary-image')) {
            this.map.removeLayer('mapillary-image');
        }
        if (this.map.getLayer('mapillary-sequence')) {
            this.map.removeLayer('mapillary-sequence');
        }
        if (this.map.getSource('mapillary')) {
            this.map.removeSource('mapillary');
        }

        this.marker.remove();
        this.popupOpen.set(false);
    }

    closePopup() {
        this.active = false;
        this.marker.remove();
        this.popupOpen.set(false);
    }

    onMouseEnter(e: mapboxgl.MapMouseEvent) {
        this.active = true;

        this.viewer.resize();
        this.viewer.moveTo(e.features[0].properties.id);

        setPointerCursor();
    }

    onMouseLeave() {
        resetCursor();
    }
}