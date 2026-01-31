import maplibregl, { type LayerSpecification, type VectorSourceSpecification } from 'maplibre-gl';
import { Viewer, type ViewerBearingEvent } from 'mapillary-js/dist/mapillary.module';
import 'mapillary-js/dist/mapillary.css';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import { ANCHOR_LAYER_KEY } from '../style';
import type { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';

const mapillarySource: VectorSourceSpecification = {
    type: 'vector',
    tiles: [
        'https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/{z}/{x}/{y}?access_token=MLY|4381405525255083|3204871ec181638c3c31320490f03011',
    ],
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
    map: maplibregl.Map;
    layerEventManager: MapLayerEventManager;
    marker: maplibregl.Marker;
    viewer: Viewer;

    active = false;
    popupOpen: { value: boolean };

    addBinded = this.add.bind(this);
    onMouseEnterBinded = this.onMouseEnter.bind(this);
    onMouseLeaveBinded = this.onMouseLeave.bind(this);

    constructor(
        map: maplibregl.Map,
        layerEventManager: MapLayerEventManager,
        container: HTMLElement,
        popupOpen: { value: boolean }
    ) {
        this.map = map;
        this.layerEventManager = layerEventManager;

        this.viewer = new Viewer({
            accessToken: 'MLY|4381405525255083|3204871ec181638c3c31320490f03011',
            container,
        });

        const element = document.createElement('div');
        element.className = 'maplibregl-user-location maplibregl-user-location-show-heading';
        const dot = document.createElement('div');
        dot.className = 'maplibregl-user-location-dot';
        element.appendChild(dot);

        this.marker = new maplibregl.Marker({
            rotationAlignment: 'map',
            element,
        });

        this.viewer.on('position', async () => {
            if (this.active) {
                popupOpen.value = true;
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
            this.map.addLayer(mapillarySequenceLayer, ANCHOR_LAYER_KEY.mapillary);
        }
        if (!this.map.getLayer('mapillary-image')) {
            this.map.addLayer(mapillaryImageLayer, ANCHOR_LAYER_KEY.mapillary);
        }
        this.map.on('style.load', this.addBinded);
        this.layerEventManager.on('mouseenter', 'mapillary-image', this.onMouseEnterBinded);
        this.layerEventManager.on('mouseleave', 'mapillary-image', this.onMouseLeaveBinded);
    }

    remove() {
        this.map.off('style.load', this.addBinded);
        this.layerEventManager.off('mouseenter', 'mapillary-image', this.onMouseEnterBinded);
        this.layerEventManager.off('mouseleave', 'mapillary-image', this.onMouseLeaveBinded);

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
        this.popupOpen.value = false;
    }

    closePopup() {
        this.active = false;
        this.marker.remove();
        this.popupOpen.value = false;
    }

    onMouseEnter(e: maplibregl.MapLayerMouseEvent) {
        if (
            e.features &&
            e.features.length > 0 &&
            e.features[0].properties &&
            e.features[0].properties.id
        ) {
            this.active = true;

            this.viewer.resize();
            this.viewer.moveTo(e.features[0].properties.id);

            mapCursor.notify(MapCursorState.MAPILLARY_HOVER, true);
        }
    }

    onMouseLeave() {
        mapCursor.notify(MapCursorState.MAPILLARY_HOVER, false);
    }
}
