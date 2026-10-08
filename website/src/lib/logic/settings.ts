import {
    basemaps,
    defaultBasemap,
    defaultBasemapTree,
    defaultOpacities,
    defaultOverlays,
    defaultOverlayTree,
    defaultOverpassQueries,
    defaultOverpassTree,
    defaultTerrainSource,
    overpassTree,
    type CustomLayer,
    type LayerTreeType,
} from '$lib/assets/layers';
import { browser } from '$app/environment';
import { engine } from '$lib/engine';
import { get, writable, type Writable } from 'svelte/store';

/** What the settings were saved as, by key: JSON strings (see `Engine.openStorage`). */
export type StoredSettings = Record<string, string>;

/** Reads the saved value of a setting, `undefined` if there is none or if it cannot be read. */
function storedValue(stored: StoredSettings, key: string): { value: any } | undefined {
    if (!Object.hasOwn(stored, key)) {
        return undefined;
    }
    try {
        return { value: JSON.parse(stored[key]) };
    } catch {
        return undefined;
    }
}

/** Keeps a value; `undefined` is not something JSON can hold, it means no value. */
function save(key: string, value: unknown) {
    const json = JSON.stringify(value);
    if (json === undefined) {
        engine.deleteSetting(key);
    } else {
        engine.setSetting(key, json);
    }
}

export class Setting<V> {
    private _key: string;
    private _value: Writable<V>;
    private _validator?: (value: V) => V;

    constructor(key: string, initial: V, validator?: (value: V) => V) {
        this._key = key;
        this._value = writable(initial);
        this._validator = validator;
    }

    /** Takes the saved value, if there is one. */
    connect(stored: StoredSettings) {
        const saved = storedValue(stored, this._key);
        if (saved) {
            this._value.set(this._validator ? this._validator(saved.value) : saved.value);
        }
    }

    subscribe(run: (value: V) => void, invalidate?: (value?: V) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(value: V) {
        if (typeof value === 'object' || value !== get(this._value)) {
            this._value.set(value);
            save(this._key, value);
        }
    }

    update(callback: (value: any) => any) {
        this.set(callback(get(this._value)));
    }
}

/** A setting that has no value until it is connected: then the saved one, or the initial one. */
export class SettingInitOnFirstRead<V> {
    private _key: string;
    private _value: Writable<V | undefined>;
    private _initial: V;
    private _validator?: (value: V) => V;

    constructor(key: string, initial: V, validator?: (value: V) => V) {
        this._key = key;
        this._value = writable(undefined);
        this._initial = initial;
        this._validator = validator;
    }

    connect(stored: StoredSettings) {
        const saved = storedValue(stored, this._key);
        if (saved) {
            this._value.set(this._validator ? this._validator(saved.value) : saved.value);
        } else {
            this._value.set(this._initial);
        }
    }

    initialize() {
        this.set(this._initial);
    }

    subscribe(run: (value: V | undefined) => void, invalidate?: (value?: V | undefined) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(value: V) {
        if (typeof value === 'object' || value !== get(this._value)) {
            this._value.set(value);
            save(this._key, value);
        }
    }

    update(callback: (value: any) => any) {
        this.set(callback(get(this._value)));
    }
}

function getValueValidator<V>(allowed: V[], fallback: V) {
    const dict = new Set<V>(allowed);
    return (value: V) => (dict.has(value) ? value : fallback);
}

function getArrayValidator<V>(allowed: V[]) {
    const dict = new Set<V>(allowed);
    return (value: V[]) => value.filter((v) => dict.has(v));
}

function getLayerValidator(allowed: Record<string, any>, fallback: string) {
    return (layer: string) =>
        allowed.hasOwnProperty(layer) ||
        layer.startsWith('custom-') ||
        layer.startsWith('extension-')
            ? layer
            : fallback;
}

function filterLayerTree(t: LayerTreeType, allowed: LayerTreeType | undefined): LayerTreeType {
    const filtered: LayerTreeType = {};
    if (allowed) {
        Object.entries(allowed).forEach(([key, value]) => {
            if (Object.hasOwn(t, key)) {
                if (typeof value === 'boolean') {
                    filtered[key] = t[key];
                } else if (typeof value === 'object') {
                    filtered[key] = filterLayerTree(
                        typeof t[key] === 'object' ? t[key] : {},
                        value
                    );
                }
            } else {
                filtered[key] = value;
            }
        });
    }
    Object.entries(t).forEach(([key, value]) => {
        if (!Object.hasOwn(filtered, key)) {
            if (typeof value === 'boolean') {
                if (key.startsWith('custom-') || key.startsWith('extension-')) {
                    filtered[key] = value;
                }
            } else if (typeof value === 'object') {
                filtered[key] = filterLayerTree(value, undefined);
            }
        }
    });
    return filtered;
}

function getLayerTreeValidator(allowed: LayerTreeType) {
    return (value: LayerTreeType) => filterLayerTree(value, allowed);
}

type DistanceUnits = 'metric' | 'imperial' | 'nautical';
type VelocityUnits = 'speed' | 'pace';
type TemperatureUnits = 'celsius' | 'fahrenheit';
type AdditionalDataset = 'speed' | 'hr' | 'cad' | 'atemp' | 'power';
type ElevationFill = 'slope' | 'surface' | 'highway' | undefined;
type RoutingProfile =
    | 'bike'
    | 'racing_bike'
    | 'gravel_bike'
    | 'mountain_bike'
    | 'foot'
    | 'motorcycle'
    | 'water'
    | 'railway';
type TerrainSource = 'mapterhorn';
type StreetViewSource = 'mapillary' | 'google';

export const settings = {
    distanceUnits: new Setting<DistanceUnits>(
        'distanceUnits',
        'metric',
        getValueValidator<DistanceUnits>(['metric', 'imperial', 'nautical'], 'metric')
    ),
    velocityUnits: new Setting<VelocityUnits>(
        'velocityUnits',
        'speed',
        getValueValidator<VelocityUnits>(['speed', 'pace'], 'speed')
    ),
    temperatureUnits: new Setting<TemperatureUnits>(
        'temperatureUnits',
        'celsius',
        getValueValidator<TemperatureUnits>(['celsius', 'fahrenheit'], 'celsius')
    ),
    elevationProfile: new Setting<boolean>('elevationProfile', true),
    additionalDatasets: new Setting<AdditionalDataset[]>(
        'additionalDatasets',
        [],
        getArrayValidator<AdditionalDataset>(['speed', 'hr', 'cad', 'atemp', 'power'])
    ),
    elevationFill: new Setting<ElevationFill>(
        'elevationFill',
        undefined,
        getValueValidator(['slope', 'surface', 'highway', undefined], undefined)
    ),
    treeFileView: new Setting<boolean>('fileView', false),
    minimizeRoutingMenu: new Setting('minimizeRoutingMenu', false),
    routing: new Setting('routing', true),
    routingProfile: new Setting<RoutingProfile>(
        'routingProfile',
        'bike',
        getValueValidator<RoutingProfile>(
            [
                'bike',
                'racing_bike',
                'gravel_bike',
                'mountain_bike',
                'foot',
                'motorcycle',
                'water',
                'railway',
            ],
            'bike'
        )
    ),
    privateRoads: new Setting('privateRoads', false),
    currentBasemap: new Setting(
        'currentBasemap',
        defaultBasemap,
        getLayerValidator(basemaps, defaultBasemap)
    ),
    previousBasemap: new Setting(
        'previousBasemap',
        defaultBasemap,
        getLayerValidator(basemaps, defaultBasemap)
    ),
    selectedBasemapTree: new Setting(
        'selectedBasemapTree',
        defaultBasemapTree,
        getLayerTreeValidator(defaultBasemapTree)
    ),
    currentOverlays: new SettingInitOnFirstRead(
        'currentOverlays',
        defaultOverlays,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    previousOverlays: new Setting(
        'previousOverlays',
        defaultOverlays,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    selectedOverlayTree: new Setting(
        'selectedOverlayTree',
        defaultOverlayTree,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    currentOverpassQueries: new SettingInitOnFirstRead(
        'currentOverpassQueries',
        defaultOverpassQueries,
        getLayerTreeValidator(overpassTree)
    ),
    selectedOverpassTree: new Setting(
        'selectedOverpassTree',
        defaultOverpassTree,
        getLayerTreeValidator(overpassTree)
    ),
    opacities: new Setting('opacities', defaultOpacities),
    customLayers: new Setting<Record<string, CustomLayer>>('customLayers', {}),
    customBasemapOrder: new Setting<string[]>('customBasemapOrder', []),
    customOverlayOrder: new Setting<string[]>('customOverlayOrder', []),
    terrainSource: new Setting<TerrainSource>(
        'terrainSource',
        defaultTerrainSource,
        getValueValidator(['mapterhorn'], defaultTerrainSource)
    ),
    directionMarkers: new Setting('directionMarkers', false),
    distanceMarkers: new Setting('distanceMarkers', false),
    streetViewSource: new Setting<StreetViewSource>(
        'streetViewSource',
        'mapillary',
        getValueValidator<StreetViewSource>(['mapillary', 'google'], 'mapillary')
    ),
    fileOrder: new Setting<string[]>('fileOrder', []),
    defaultOpacity: new Setting('defaultOpacity', 0.7),
    defaultWidth: new Setting('defaultWidth', browser && window.innerWidth < 600 ? 8 : 5),
    bottomPanelSize: new Setting('bottomPanelSize', 170),
    rightPanelSize: new Setting('rightPanelSize', 240),
    /** Takes the saved values (see `Engine.openStorage`). */
    connect(stored: StoredSettings) {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof Setting || setting instanceof SettingInitOnFirstRead) {
                setting.connect(stored);
            }
        }
    },
    initialize() {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof SettingInitOnFirstRead) {
                setting.initialize();
            }
        }
    },
};
