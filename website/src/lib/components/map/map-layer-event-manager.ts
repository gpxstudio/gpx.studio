import maplibregl from 'maplibre-gl';

type MapLayerMouseEventListener = (e: maplibregl.MapLayerMouseEvent) => void;
type MapLayerTouchEventListener = (e: maplibregl.MapLayerTouchEvent) => void;
type MapLayerListener = {
    features: maplibregl.MapGeoJSONFeature[];
    mousemoves: MapLayerMouseEventListener[];
    mouseenters: MapLayerMouseEventListener[];
    mouseleaves: MapLayerMouseEventListener[];
    mousedowns: MapLayerMouseEventListener[];
    clicks: MapLayerMouseEventListener[];
    contextmenus: MapLayerMouseEventListener[];
    touchstarts: MapLayerTouchEventListener[];
};

export class MapLayerEventManager {
    private _map: maplibregl.Map;
    private _listeners: Record<string, MapLayerListener> = {};

    constructor(map: maplibregl.Map) {
        this._map = map;
        this._map.on('mousemove', this._handleMouseMove.bind(this));
        this._map.on('click', this._handleMouseClick.bind(this, 'click'));
        this._map.on('contextmenu', this._handleMouseClick.bind(this, 'contextmenu'));
        this._map.on('mousedown', this._handleMouseClick.bind(this, 'mousedown'));
        this._map.on('touchstart', this._handleTouchStart.bind(this));
    }

    on(
        eventType:
            | 'mousemove'
            | 'mouseenter'
            | 'mouseleave'
            | 'mousedown'
            | 'click'
            | 'contextmenu'
            | 'touchstart',

        layerId: string,
        listener: MapLayerMouseEventListener | MapLayerTouchEventListener
    ) {
        if (!this._listeners[layerId]) {
            this._listeners[layerId] = {
                features: [],
                mousemoves: [],
                mouseenters: [],
                mouseleaves: [],
                mousedowns: [],
                clicks: [],
                contextmenus: [],
                touchstarts: [],
            };
        }
        switch (eventType) {
            case 'mousemove':
                this._listeners[layerId].mousemoves.push(listener as MapLayerMouseEventListener);
                break;
            case 'mouseenter':
                this._listeners[layerId].mouseenters.push(listener as MapLayerMouseEventListener);
                break;
            case 'mouseleave':
                this._listeners[layerId].mouseleaves.push(listener as MapLayerMouseEventListener);
                break;
            case 'mousedown':
                this._listeners[layerId].mousedowns.push(listener as MapLayerMouseEventListener);
                break;
            case 'click':
                this._listeners[layerId].clicks.push(listener as MapLayerMouseEventListener);
                break;
            case 'contextmenu':
                this._listeners[layerId].contextmenus.push(listener as MapLayerMouseEventListener);
                break;
            case 'touchstart':
                this._listeners[layerId].touchstarts.push(listener as MapLayerTouchEventListener);
                break;
        }
    }

    off(
        eventType:
            | 'mousemove'
            | 'mouseenter'
            | 'mouseleave'
            | 'mousedown'
            | 'click'
            | 'contextmenu'
            | 'touchstart',
        layerId: string,
        listener: MapLayerMouseEventListener | MapLayerTouchEventListener
    ) {
        if (this._listeners[layerId]) {
            switch (eventType) {
                case 'mousemove':
                    this._listeners[layerId].mousemoves = this._listeners[
                        layerId
                    ].mousemoves.filter((l) => l !== listener);
                    break;
                case 'mouseenter':
                    this._listeners[layerId].mouseenters = this._listeners[
                        layerId
                    ].mouseenters.filter((l) => l !== listener);
                    break;
                case 'mouseleave':
                    this._listeners[layerId].mouseleaves = this._listeners[
                        layerId
                    ].mouseleaves.filter((l) => l !== listener);
                    break;
                case 'mousedown':
                    this._listeners[layerId].mousedowns = this._listeners[
                        layerId
                    ].mousedowns.filter((l) => l !== listener);
                    break;
                case 'click':
                    this._listeners[layerId].clicks = this._listeners[layerId].clicks.filter(
                        (l) => l !== listener
                    );
                    break;
                case 'contextmenu':
                    this._listeners[layerId].contextmenus = this._listeners[
                        layerId
                    ].contextmenus.filter((l) => l !== listener);
                    break;
                case 'touchstart':
                    this._listeners[layerId].touchstarts = this._listeners[
                        layerId
                    ].touchstarts.filter((l) => l !== listener);
                    break;
            }
            if (
                this._listeners[layerId].mousemoves.length === 0 &&
                this._listeners[layerId].mouseenters.length === 0 &&
                this._listeners[layerId].mouseleaves.length === 0 &&
                this._listeners[layerId].mousedowns.length === 0 &&
                this._listeners[layerId].clicks.length === 0 &&
                this._listeners[layerId].contextmenus.length === 0 &&
                this._listeners[layerId].touchstarts.length === 0
            ) {
                delete this._listeners[layerId];
            }
        }
    }

    private _handleMouseMove(e: maplibregl.MapMouseEvent) {
        const layerIds = Object.keys(this._listeners);
        const features =
            layerIds.length > 0
                ? this._map.queryRenderedFeatures(e.point, { layers: layerIds })
                : [];
        const featuresByLayer: Record<string, maplibregl.MapGeoJSONFeature[]> = {};
        features.forEach((f) => {
            if (!featuresByLayer[f.layer.id]) {
                featuresByLayer[f.layer.id] = [];
            }
            featuresByLayer[f.layer.id].push(f);
        });
        Object.keys(this._listeners).forEach((layerId) => {
            const features = featuresByLayer[layerId] || [];
            const listener = this._listeners[layerId];
            if ((features.length == 0) != (listener.features.length == 0)) {
                if (features.length > 0) {
                    if (listener.mouseenters.length > 0) {
                        const event = new maplibregl.MapMouseEvent(
                            'mouseenter',
                            e.target,
                            e.originalEvent,
                            {
                                features: featuresByLayer[layerId]!,
                            }
                        );
                        listener.mouseenters.forEach((l) => l(event));
                    }
                } else {
                    if (listener.mouseleaves.length > 0) {
                        const event = new maplibregl.MapMouseEvent(
                            'mouseleave',
                            e.target,
                            e.originalEvent
                        );
                        listener.mouseleaves.forEach((l) => l(event));
                    }
                }
                listener.features = features;
            }
            if (features.length > 0 && listener.mousemoves.length > 0) {
                const event = new maplibregl.MapMouseEvent('mousemove', e.target, e.originalEvent, {
                    features: featuresByLayer[layerId]!,
                });
                listener.mousemoves.forEach((l) => l(event));
            }
        });
    }

    private _handleMouseClick(type: string, e: maplibregl.MapMouseEvent) {
        Object.values(this._listeners).forEach((listener) => {
            if (listener.features.length > 0) {
                if (type === 'click' && listener.clicks.length > 0) {
                    const event = new maplibregl.MapMouseEvent('click', e.target, e.originalEvent, {
                        features: listener.features,
                    });
                    listener.clicks.forEach((l) => l(event));
                } else if (type === 'contextmenu' && listener.contextmenus.length > 0) {
                    const event = new maplibregl.MapMouseEvent(
                        'contextmenu',
                        e.target,
                        e.originalEvent,
                        {
                            features: listener.features,
                        }
                    );
                    listener.contextmenus.forEach((l) => l(event));
                } else if (type === 'mousedown' && listener.mousedowns.length > 0) {
                    const event = new maplibregl.MapMouseEvent(
                        'mousedown',
                        e.target,
                        e.originalEvent,
                        {
                            features: listener.features,
                        }
                    );
                    listener.mousedowns.forEach((l) => l(event));
                }
            }
        });
    }

    private _handleTouchStart(e: maplibregl.MapTouchEvent) {
        const layerIds = Object.keys(this._listeners).filter(
            (layerId) => this._listeners[layerId].touchstarts.length > 0
        );
        if (layerIds.length === 0) return;
        const features = this._map.queryRenderedFeatures(e.points[0], { layers: layerIds });
        const featuresByLayer: Record<string, maplibregl.MapGeoJSONFeature[]> = {};
        features.forEach((f) => {
            if (!featuresByLayer[f.layer.id]) {
                featuresByLayer[f.layer.id] = [];
            }
            featuresByLayer[f.layer.id].push(f);
        });
        Object.keys(this._listeners).forEach((layerId) => {
            const features = featuresByLayer[layerId] || [];
            const listener = this._listeners[layerId];
            if (features.length > 0) {
                const event: maplibregl.MapLayerTouchEvent = new maplibregl.MapTouchEvent(
                    'touchstart',
                    e.target,
                    e.originalEvent
                );
                event.features = featuresByLayer[layerId]!;
                listener.touchstarts.forEach((l) => l(event));
            }
        });
    }
}
