import { get, writable, type Writable } from 'svelte/store';
import type { LayerTreeType } from '$lib/assets/layers';

/** What the settings were saved as, by key: JSON strings (see `Engine.openStorage`). */
export type StoredSettings = Record<string, string>;

/** Where the settings are kept. */
export type SettingsStorage = {
    /** Keeps the JSON of a setting. */
    save(key: string, json: string): void;
    /** Forgets a setting. */
    remove(key: string): void;
};

let storage: SettingsStorage | undefined;

/** Sets where the settings are kept: until then, changes are not saved. */
export function useSettingsStorage(newStorage: SettingsStorage | undefined) {
    storage = newStorage;
}

/** Reads the saved value of a setting, `undefined` if there is none or if it cannot be read. */
export function storedValue(stored: StoredSettings, key: string): { value: any } | undefined {
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
        storage?.remove(key);
    } else {
        storage?.save(key, json);
    }
}

/**
 * A setting: a store whose value is kept when it changes. `S` is what the store holds, which is
 * `V` or, for a setting that has no value until it is read, `V | undefined`.
 */
abstract class SettingBase<V, S extends V | undefined> {
    protected _key: string;
    protected _value: Writable<S>;
    protected _validator?: (value: V) => V;

    protected constructor(key: string, initial: S, validator?: (value: V) => V) {
        this._key = key;
        this._value = writable(initial);
        this._validator = validator;
    }

    /** The saved value, validated, `undefined` if there is none. */
    protected saved(stored: StoredSettings): { value: V } | undefined {
        const saved = storedValue(stored, this._key);
        return saved && { value: this._validator ? this._validator(saved.value) : saved.value };
    }

    /** Takes the saved value, if there is one. */
    abstract connect(stored: StoredSettings): void;

    subscribe(run: (value: S) => void, invalidate?: (value?: S) => void) {
        return this._value.subscribe(run, invalidate);
    }

    /** Sets the value and keeps it. An object is always kept: it may have been changed in place. */
    set(value: V) {
        if (typeof value === 'object' || value !== get(this._value)) {
            this._value.set(value as S);
            save(this._key, value);
        }
    }

    update(callback: (value: any) => any) {
        this.set(callback(get(this._value)));
    }
}

export class Setting<V> extends SettingBase<V, V> {
    constructor(key: string, initial: V, validator?: (value: V) => V) {
        super(key, initial, validator);
    }

    connect(stored: StoredSettings) {
        const saved = this.saved(stored);
        if (saved) {
            this._value.set(saved.value);
        }
    }
}

/** A setting that has no value until it is connected: then the saved one, or the initial one. */
export class SettingInitOnFirstRead<V> extends SettingBase<V, V | undefined> {
    private _initial: V;

    constructor(key: string, initial: V, validator?: (value: V) => V) {
        super(key, undefined, validator);
        this._initial = initial;
    }

    connect(stored: StoredSettings) {
        this._value.set(this.saved(stored)?.value ?? this._initial);
    }

    /** Takes the initial value and keeps it, for a setting that was never saved. */
    initialize() {
        this.set(this._initial);
    }
}

export function getValueValidator<V>(allowed: V[], fallback: V) {
    const dict = new Set<V>(allowed);
    return (value: V) => (dict.has(value) ? value : fallback);
}

export function getArrayValidator<V>(allowed: V[]) {
    const dict = new Set<V>(allowed);
    return (value: V[]) => value.filter((v) => dict.has(v));
}

export function getLayerValidator(allowed: Record<string, any>, fallback: string) {
    return (layer: string) =>
        allowed.hasOwnProperty(layer) ||
        layer.startsWith('custom-') ||
        layer.startsWith('extension-')
            ? layer
            : fallback;
}

export function filterLayerTree(
    t: LayerTreeType,
    allowed: LayerTreeType | undefined
): LayerTreeType {
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

export function getLayerTreeValidator(allowed: LayerTreeType) {
    return (value: LayerTreeType) => filterLayerTree(value, allowed);
}
