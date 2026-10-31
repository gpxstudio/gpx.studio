import { get, writable, type Writable } from 'svelte/store';
import type { LayerTreeType } from '$lib/data/layers';

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
export function storedValue(stored: StoredSettings, key: string): { value: unknown } | undefined {
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
 * Makes a saved value one that the setting can hold: what was saved can be anything (an old
 * format, a value that is not allowed anymore), the validator checks it.
 */
export type Validator<V> = (value: unknown) => V;

/**
 * The validator of a setting: a boolean or a number can do without one, its saved value is then
 * checked against the type of its initial value. The other settings say what they can hold: a
 * string is often one of a few, an object has a shape.
 */
type ValidatorArgument<V> = [V] extends [boolean] | [number]
    ? [validator?: Validator<V>]
    : [validator: Validator<V>];

/** Keeps a saved value that has the type of the initial one (a boolean or a number). */
function sameTypeAs<V>(initial: V): Validator<V> {
    return (value) => (typeof value === typeof initial ? (value as V) : initial);
}

/**
 * A setting: a store whose value is kept when it changes. `S` is what the store holds, which is
 * `V` or, for a setting that has no value until it is read, `V | undefined`.
 */
abstract class SettingBase<V, S extends V | undefined> {
    protected _key: string;
    protected _value: Writable<S>;
    protected _validator: Validator<V>;

    protected constructor(key: string, initial: S, validator: Validator<V>) {
        this._key = key;
        this._value = writable(initial);
        this._validator = validator;
    }

    /** The saved value, validated, `undefined` if there is none. */
    protected saved(stored: StoredSettings): { value: V } | undefined {
        const saved = storedValue(stored, this._key);
        return saved && { value: this._validator(saved.value) };
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
    constructor(key: string, initial: V, ...[validator]: ValidatorArgument<V>) {
        super(key, initial, validator ?? sameTypeAs(initial));
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

    constructor(key: string, initial: V, ...[validator]: ValidatorArgument<V>) {
        super(key, undefined, validator ?? sameTypeAs(initial));
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

/** Whether a value is one of the allowed ones. */
function oneOf<V>(allowed: V[]) {
    const dict = new Set<unknown>(allowed);
    return (value: unknown): value is V => dict.has(value);
}

export function getValueValidator<V>(allowed: V[], fallback: V): Validator<V> {
    const isAllowed = oneOf(allowed);
    return (value) => (isAllowed(value) ? value : fallback);
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

/** Keeps the items of a saved list that are what it holds, in their order; nothing if it is not a list. */
export function getListValidator<V>(isItem: (value: unknown) => value is V): Validator<V[]> {
    return (value) => (Array.isArray(value) ? value.filter(isItem) : []);
}

/** Keeps the allowed values of a list, in their order; nothing if what was saved is not a list. */
export function getArrayValidator<V>(allowed: V[]): Validator<V[]> {
    return getListValidator(oneOf(allowed));
}

/** Keeps the entries of a saved record that are what it holds; `fallback` if it is not a record. */
export function getRecordValidator<V>(
    isEntry: (value: unknown) => value is V,
    fallback: Record<string, V>
): Validator<Record<string, V>> {
    return (value) =>
        isRecord(value)
            ? Object.fromEntries(
                  Object.entries(value).filter((entry): entry is [string, V] => isEntry(entry[1]))
              )
            : fallback;
}

export function getLayerValidator(
    allowed: Record<string, unknown>,
    fallback: string
): Validator<string> {
    return (layer) =>
        typeof layer === 'string' &&
        (Object.hasOwn(allowed, layer) ||
            layer.startsWith('custom-') ||
            layer.startsWith('extension-'))
            ? layer
            : fallback;
}

/** Whether a value is a record, which can hold the layers of a tree: an object, not null or a list. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The saved tree `t`, with the layers of `allowed`: the choices saved for them are kept, the new
 * ones have their default, and of the others only the custom and extension layers are kept.
 */
export function filterLayerTree(t: unknown, allowed: LayerTreeType | undefined): LayerTreeType {
    const tree = isRecord(t) ? t : {};
    const filtered: LayerTreeType = {};
    if (allowed) {
        Object.entries(allowed).forEach(([key, value]) => {
            const saved = Object.hasOwn(tree, key) ? tree[key] : undefined;
            if (typeof value === 'boolean') {
                filtered[key] = typeof saved === 'boolean' ? saved : value;
            } else {
                filtered[key] = filterLayerTree(saved, value);
            }
        });
    }
    Object.entries(tree).forEach(([key, value]) => {
        if (!Object.hasOwn(filtered, key)) {
            if (typeof value === 'boolean') {
                if (key.startsWith('custom-') || key.startsWith('extension-')) {
                    filtered[key] = value;
                }
            } else if (isRecord(value)) {
                filtered[key] = filterLayerTree(value, undefined);
            }
        }
    });
    return filtered;
}

export function getLayerTreeValidator(allowed: LayerTreeType): Validator<LayerTreeType> {
    return (value) => filterLayerTree(value, allowed);
}
