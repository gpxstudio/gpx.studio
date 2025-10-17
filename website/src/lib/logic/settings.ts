import { db, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import {
    defaultBasemap,
    defaultBasemapTree,
    defaultOpacities,
    defaultOverlays,
    defaultOverlayTree,
    defaultOverpassQueries,
    defaultOverpassTree,
    type CustomLayer,
} from '$lib/assets/layers';
import { browser } from '$app/environment';
import { get, writable, type Writable } from 'svelte/store';

export class Setting<V> {
    private _db: Database;
    private _key: string;
    private _value: Writable<V>;

    constructor(db: Database, key: string, initial: V) {
        this._db = db;
        this._key = key;
        this._value = writable(initial);

        let first = true;
        liveQuery(() => db.settings.get(key)).subscribe((value) => {
            if (value === undefined) {
                if (!first) {
                    this._value.set(value);
                }
            } else {
                this._value.set(value);
            }
            first = false;
        });
    }

    subscribe(run: (value: V) => void, invalidate?: (value?: V) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(newValue: V) {
        if (typeof newValue === 'object' || newValue !== get(this._value)) {
            this._db.settings.put(newValue, this._key);
        }
    }

    update(callback: (value: any) => any) {
        let newValue = callback(get(this._value));
        if (typeof newValue === 'object' || newValue !== get(this._value)) {
            this._db.settings.put(newValue, this._key);
        }
    }
}

export class SettingInitOnFirstRead<V> {
    private _db: Database;
    private _key: string;
    private _value: Writable<V | undefined>;

    constructor(db: Database, key: string, initial: V) {
        this._db = db;
        this._key = key;
        this._value = writable(undefined);

        let first = true;
        liveQuery(() => db.settings.get(key)).subscribe((value) => {
            if (value === undefined) {
                if (first) {
                    this._value.set(initial);
                } else {
                    this._value.set(value);
                }
            } else {
                this._value.set(value);
            }
            first = false;
        });
    }

    subscribe(run: (value: V | undefined) => void, invalidate?: (value?: V | undefined) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(newValue: V) {
        if (typeof newValue === 'object' || newValue !== get(this._value)) {
            this._db.settings.put(newValue, this._key);
        }
    }

    update(callback: (value: any) => any) {
        let newValue = callback(get(this._value));
        if (typeof newValue === 'object' || newValue !== get(this._value)) {
            this._db.settings.put(newValue, this._key);
        }
    }
}

export const settings = {
    distanceUnits: new Setting<'metric' | 'imperial' | 'nautical'>(db, 'distanceUnits', 'metric'),
    velocityUnits: new Setting<'speed' | 'pace'>(db, 'velocityUnits', 'speed'),
    temperatureUnits: new Setting<'celsius' | 'fahrenheit'>(db, 'temperatureUnits', 'celsius'),
    elevationProfile: new Setting<boolean>(db, 'elevationProfile', true),
    additionalDatasets: new Setting<string[]>(db, 'additionalDatasets', []),
    elevationFill: new Setting<'slope' | 'surface' | undefined>(db, 'elevationFill', undefined),
    treeFileView: new Setting<boolean>(db, 'fileView', false),
    minimizeRoutingMenu: new Setting(db, 'minimizeRoutingMenu', false),
    routing: new Setting(db, 'routing', true),
    routingProfile: new Setting(db, 'routingProfile', 'bike'),
    privateRoads: new Setting(db, 'privateRoads', false),
    currentBasemap: new Setting(db, 'currentBasemap', defaultBasemap),
    previousBasemap: new Setting(db, 'previousBasemap', defaultBasemap),
    selectedBasemapTree: new Setting(db, 'selectedBasemapTree', defaultBasemapTree),
    currentOverlays: new SettingInitOnFirstRead(db, 'currentOverlays', defaultOverlays),
    previousOverlays: new Setting(db, 'previousOverlays', defaultOverlays),
    selectedOverlayTree: new Setting(db, 'selectedOverlayTree', defaultOverlayTree),
    currentOverpassQueries: new SettingInitOnFirstRead(
        db,
        'currentOverpassQueries',
        defaultOverpassQueries
    ),
    selectedOverpassTree: new Setting(db, 'selectedOverpassTree', defaultOverpassTree),
    opacities: new Setting(db, 'opacities', defaultOpacities),
    customLayers: new Setting<Record<string, CustomLayer>>(db, 'customLayers', {}),
    customBasemapOrder: new Setting<string[]>(db, 'customBasemapOrder', []),
    customOverlayOrder: new Setting<string[]>(db, 'customOverlayOrder', []),
    directionMarkers: new Setting(db, 'directionMarkers', false),
    distanceMarkers: new Setting(db, 'distanceMarkers', false),
    streetViewSource: new Setting(db, 'streetViewSource', 'mapillary'),
    fileOrder: new Setting<string[]>(db, 'fileOrder', []),
    defaultOpacity: new Setting(db, 'defaultOpacity', 0.7),
    defaultWidth: new Setting(db, 'defaultWidth', browser && window.innerWidth < 600 ? 8 : 5),
    bottomPanelSize: new Setting(db, 'bottomPanelSize', 170),
    rightPanelSize: new Setting(db, 'rightPanelSize', 240),
};
