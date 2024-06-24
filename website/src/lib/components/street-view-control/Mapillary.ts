import mapboxgl from "mapbox-gl";
import { Viewer } from 'mapillary-js/dist/mapillary.module';
import 'mapillary-js/dist/mapillary.css';
import { t } from "svelte-i18n";
import { resetCursor, setPointerCursor } from "$lib/utils";

const mapillarySource = {
    type: 'vector',
    tiles: ['https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/{z}/{x}/{y}?access_token=MLY|4381405525255083|3204871ec181638c3c31320490f03011'],
    minzoom: 6,
    maxzoom: 14,
};

const mapillarySequenceLayer = {
    id: 'mapillary-sequence',
    type: 'line',
    source: 'mapillary',
    'source-layer': 'sequence',
    paint: {
        'line-color': 'rgb(53, 175, 109)',
        'line-opacity': 0.5,
        'line-width': 4,
    },
    layout: {
        'line-cap': 'round',
        'line-join': 'round',
    },
};

const mapillaryImageLayer = {
    id: 'mapillary-image',
    type: 'circle',
    source: 'mapillary',
    'source-layer': 'image',
    paint: {
        'circle-color': 'rgb(53, 175, 109)',
        'circle-radius': 4,
        'circle-opacity': 0.5,
    },
};

export class MapillaryLayer {
    map: mapboxgl.Map;
    popup: mapboxgl.Popup;
    viewer: Viewer;
    addBinded = this.add.bind(this);
    onMouseEnterBinded = this.onMouseEnter.bind(this);
    onMouseLeaveBinded = this.onMouseLeave.bind(this);

    constructor(map: mapboxgl.Map) {
        this.map = map;

        const container = document.createElement('div');
        container.style.width = '400px';
        container.style.height = '300px';
        container.className = 'rounded-md border-background border-2'

        this.viewer = new Viewer({
            accessToken: 'MLY|4381405525255083|3204871ec181638c3c31320490f03011',
            container,
        });

        this.popup = new mapboxgl.Popup({
            closeButton: false,
            maxWidth: container.style.width,
        }).setDOMContent(container);

        this.viewer.on('position', async () => {
            if (this.popup.isOpen()) {
                let latLng = await this.viewer.getPosition();
                this.popup.setLngLat(latLng);
                if (!this.map.getBounds().contains(latLng)) {
                    this.map.panTo(latLng);
                }
            }
        });
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

        this.popup.remove();
    }

    onMouseEnter(e: mapboxgl.MapLayerMouseEvent) {
        this.popup.addTo(this.map).setLngLat(e.lngLat);
        this.viewer.resize();
        this.viewer.moveTo(e.features[0].properties.id);

        setPointerCursor();
    }

    onMouseLeave() {
        resetCursor();
    }
}