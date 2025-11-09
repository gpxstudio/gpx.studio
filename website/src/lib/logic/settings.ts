import { type Database } from '$lib/db';
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
    private _db: Database | null = null;
    private _subscription: { unsubscribe: () => void } | null = null;
    private _key: string;
    private _value: Writable<V>;

    constructor(key: string, initial: V) {
        this._key = key;
        this._value = writable(initial);
    }

    connectToDatabase(db: Database) {
        if (this._db) return;
        this._db = db;

        let first = true;
        this._subscription = liveQuery(() => db.settings.get(this._key)).subscribe((value) => {
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

    disconnectFromDatabase() {
        this._subscription?.unsubscribe();
        this._subscription = null;
        this._db = null;
    }

    subscribe(run: (value: V) => void, invalidate?: (value?: V) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(value: V) {
        if (typeof value === 'object' || value !== get(this._value)) {
            if (this._db) {
                this._db.settings.put(value, this._key);
            } else {
                this._value.set(value);
            }
        }
    }

    update(callback: (value: any) => any) {
        this.set(callback(get(this._value)));
    }
}

export class SettingInitOnFirstRead<V> {
    private _db: Database | null = null;
    private _subscription: { unsubscribe: () => void } | null = null;
    private _key: string;
    private _value: Writable<V | undefined>;
    private _initial: V;

    constructor(key: string, initial: V) {
        this._key = key;
        this._value = writable(undefined);
        this._initial = initial;
    }

    connectToDatabase(db: Database) {
        if (this._db) return;
        this._db = db;

        let first = true;
        this._subscription = liveQuery(() => db.settings.get(this._key)).subscribe((value) => {
            if (value === undefined) {
                if (first) {
                    this._value.set(this._initial);
                } else {
                    this._value.set(value);
                }
            } else {
                this._value.set(value);
            }
            first = false;
        });
    }

    disconnectFromDatabase() {
        this._subscription?.unsubscribe();
        this._subscription = null;
        this._db = null;
    }

    subscribe(run: (value: V | undefined) => void, invalidate?: (value?: V | undefined) => void) {
        return this._value.subscribe(run, invalidate);
    }

    set(value: V) {
        if (typeof value === 'object' || value !== get(this._value)) {
            if (this._db) {
                this._db.settings.put(value, this._key);
            } else {
                this._value.set(value);
            }
        }
    }

    update(callback: (value: any) => any) {
        this.set(callback(get(this._value)));
    }
}

export const settings = {
    distanceUnits: new Setting<'metric' | 'imperial' | 'nautical'>('distanceUnits', 'metric'),
    velocityUnits: new Setting<'speed' | 'pace'>('velocityUnits', 'speed'),
    temperatureUnits: new Setting<'celsius' | 'fahrenheit'>('temperatureUnits', 'celsius'),
    elevationProfile: new Setting<boolean>('elevationProfile', true),
    additionalDatasets: new Setting<string[]>('additionalDatasets', []),
    elevationFill: new Setting<'slope' | 'surface' | undefined>('elevationFill', undefined),
    treeFileView: new Setting<boolean>('fileView', false),
    minimizeRoutingMenu: new Setting('minimizeRoutingMenu', false),
    routing: new Setting('routing', true),
    routingProfile: new Setting('routingProfile', 'bike'),
    privateRoads: new Setting('privateRoads', false),
    currentBasemap: new Setting('currentBasemap', defaultBasemap),
    previousBasemap: new Setting('previousBasemap', defaultBasemap),
    selectedBasemapTree: new Setting('selectedBasemapTree', defaultBasemapTree),
    currentOverlays: new SettingInitOnFirstRead('currentOverlays', defaultOverlays),
    previousOverlays: new Setting('previousOverlays', defaultOverlays),
    selectedOverlayTree: new Setting('selectedOverlayTree', defaultOverlayTree),
    currentOverpassQueries: new SettingInitOnFirstRead(
        'currentOverpassQueries',
        defaultOverpassQueries
    ),
    selectedOverpassTree: new Setting('selectedOverpassTree', defaultOverpassTree),
    opacities: new Setting('opacities', defaultOpacities),
    customLayers: new Setting<Record<string, CustomLayer>>('customLayers', {}),
    customBasemapOrder: new Setting<string[]>('customBasemapOrder', []),
    customOverlayOrder: new Setting<string[]>('customOverlayOrder', []),
    directionMarkers: new Setting('directionMarkers', false),
    distanceMarkers: new Setting('distanceMarkers', false),
    streetViewSource: new Setting('streetViewSource', 'mapillary'),
    fileOrder: new Setting<string[]>('fileOrder', []),
    defaultOpacity: new Setting('defaultOpacity', 0.7),
    defaultWidth: new Setting('defaultWidth', browser && window.innerWidth < 600 ? 8 : 5),
    bottomPanelSize: new Setting('bottomPanelSize', 170),
    rightPanelSize: new Setting('rightPanelSize', 240),
    connectToDatabase(db: Database) {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof Setting || setting instanceof SettingInitOnFirstRead) {
                setting.connectToDatabase(db);
            }
        }
    },
    disconnectFromDatabase() {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof Setting || setting instanceof SettingInitOnFirstRead) {
                setting.disconnectFromDatabase();
            }
        }
    },
};
