/**
 * One-time import of what the previous versions of the app kept in the browser: the files and the
 * settings of an IndexedDB database named `Database` (managed with Dexie, which is not needed to
 * read it). The files were stored as the objects of the former `gpx` library; they are written
 * back as GPX, which the engine loads. The old database is left as it was.
 */

const LEGACY_DATABASE = 'Database';

/** Setting that tells that the import is done (or that there was nothing to import). */
export const LEGACY_IMPORTED_KEY = 'legacyImported';

/** Settings of the old database that mean nothing anymore. */
const DROPPED_SETTINGS = new Set(['patchIndex', 'fileOrder']);

type Json = any;

function request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** Opens the old database, `undefined` if there is none (and none is created). */
async function openLegacyDatabase(): Promise<IDBDatabase | undefined> {
    if (typeof indexedDB === 'undefined') {
        return undefined;
    }
    if (typeof indexedDB.databases === 'function') {
        const databases = await indexedDB.databases();
        if (!databases.some((database) => database.name === LEGACY_DATABASE)) {
            return undefined;
        }
    }
    return new Promise((resolve) => {
        const open = indexedDB.open(LEGACY_DATABASE);
        let created = false;
        open.onupgradeneeded = () => {
            // it did not exist: do not leave an empty database behind
            created = true;
            open.transaction?.abort();
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => {
            if (created) {
                indexedDB.deleteDatabase(LEGACY_DATABASE);
            }
            resolve(undefined);
        };
        open.onblocked = () => resolve(undefined);
    });
}

async function readAll(
    database: IDBDatabase,
    store: string
): Promise<Map<string, Json> | undefined> {
    if (!database.objectStoreNames.contains(store)) {
        return undefined;
    }
    const objectStore = database.transaction(store, 'readonly').objectStore(store);
    const [keys, values] = await Promise.all([
        request(objectStore.getAllKeys()),
        request(objectStore.getAll()),
    ]);
    return new Map(keys.map((key, i) => [String(key), values[i]]));
}

// GPX, from the stored objects

function escape(text: unknown): string {
    return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function element(name: string, value: unknown): string {
    return value === undefined || value === null || value === ''
        ? ''
        : `<${name}>${escape(value)}</${name}>`;
}

function timeElement(value: unknown): string {
    const date = value instanceof Date ? value : new Date(value as string);
    return isNaN(date.getTime()) ? '' : element('time', date.toISOString());
}

function link(value: Json): string {
    const href = value?.attributes?.href;
    return href
        ? `<link href="${escape(href).replaceAll('"', '&quot;')}">${element('text', value.text)}</link>`
        : '';
}

function coordinates(point: Json): string {
    const { lat, lon } = point.attributes ?? {};
    return `lat="${Number(lat)}" lon="${Number(lon)}"`;
}

function trackpoint(point: Json): string {
    const extensions = point.extensions ?? {};
    const trackPointExtension = extensions['gpxtpx:TrackPointExtension'] ?? {};
    const osm = Object.entries(trackPointExtension['gpxtpx:Extensions'] ?? {})
        .map(([key, value]) => element(key, value))
        .join('');
    const inner = [
        element('gpxtpx:atemp', trackPointExtension['gpxtpx:atemp']),
        element('gpxtpx:hr', trackPointExtension['gpxtpx:hr']),
        element('gpxtpx:cad', trackPointExtension['gpxtpx:cad']),
        osm ? `<gpxtpx:Extensions>${osm}</gpxtpx:Extensions>` : '',
    ].join('');
    const power = element(
        'gpxpx:PowerInWatts',
        extensions['gpxpx:PowerExtension']?.['gpxpx:PowerInWatts']
    );
    const extension =
        inner || power
            ? `<extensions>${inner ? `<gpxtpx:TrackPointExtension>${inner}</gpxtpx:TrackPointExtension>` : ''}${power ? `<gpxpx:PowerExtension>${power}</gpxpx:PowerExtension>` : ''}</extensions>`
            : '';
    return `<trkpt ${coordinates(point)}>${element('ele', point.ele)}${point.time ? timeElement(point.time) : ''}${extension}</trkpt>`;
}

function waypoint(point: Json): string {
    return `<wpt ${coordinates(point)}>${element('ele', point.ele)}${point.time ? timeElement(point.time) : ''}${element('name', point.name)}${element('cmt', point.cmt)}${element('desc', point.desc)}${link(point.link)}${element('sym', point.sym)}${element('type', point.type)}</wpt>`;
}

function track(track: Json): string {
    const style = track.extensions?.['gpx_style:line'];
    const line = style
        ? `<extensions><gpx_style:line>${element('gpx_style:color', style['gpx_style:color'])}${element('gpx_style:opacity', style['gpx_style:opacity'])}${element('gpx_style:width', style['gpx_style:width'])}</gpx_style:line></extensions>`
        : '';
    const segments = (track.trkseg ?? [])
        .map(
            (segment: Json) => `<trkseg>${(segment.trkpt ?? []).map(trackpoint).join('')}</trkseg>`
        )
        .join('');
    return `<trk>${element('name', track.name)}${element('cmt', track.cmt)}${element('desc', track.desc)}${element('src', track.src)}${link(track.link)}${element('type', track.type)}${line}${segments}</trk>`;
}

/** A file as the old versions stored it, as GPX. */
export function legacyFileToGPX(file: Json): string {
    const metadata = file.metadata ?? {};
    const author = metadata.author;
    const authorXml = author
        ? `<author>${element('name', author.name)}${link(author.link)}</author>`
        : '';
    const metadataXml = `<metadata>${element('name', metadata.name)}${element('desc', metadata.desc)}${authorXml}${link(metadata.link)}${metadata.time ? timeElement(metadata.time) : ''}</metadata>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="https://gpx.studio" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:gpxpx="http://www.garmin.com/xmlschemas/PowerExtension/v1" xmlns:gpx_style="http://www.topografix.com/GPX/gpx_style/0/2">${metadataXml}${(file.wpt ?? []).map(waypoint).join('')}${(file.trk ?? []).map(track).join('')}</gpx>`;
}

/** What the old database holds. */
export type LegacyData = {
    /** The files as GPX, in the order they had. */
    files: { gpx: string; name: string }[];
    /** The settings, as JSON strings by key. */
    settings: Record<string, string>;
};

/** Reads the old database, `undefined` if there is none. */
export async function readLegacyData(): Promise<LegacyData | undefined> {
    const database = await openLegacyDatabase();
    if (!database) {
        return undefined;
    }
    try {
        const [files, settings] = await Promise.all([
            readAll(database, 'files'),
            readAll(database, 'settings'),
        ]);
        if (!files && !settings) {
            return undefined;
        }

        // the order of the files was a setting; the ids (`gpx-<n>`) tell the order they were added in
        const byAge = [...(files?.keys() ?? [])].sort(
            (a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
        );
        const order: string[] = Array.isArray(settings?.get('fileOrder'))
            ? settings!.get('fileOrder')
            : [];
        const ids = [
            ...order.filter((id) => files?.has(id)),
            ...byAge.filter((id) => !order.includes(id)),
        ];

        const result: LegacyData = { files: [], settings: {} };
        for (const id of ids) {
            try {
                const file = files!.get(id);
                result.files.push({
                    gpx: legacyFileToGPX(file),
                    name: file?.metadata?.name || 'file',
                });
            } catch (error) {
                console.error(`Could not import the file ${id}`, error);
            }
        }
        for (const [key, value] of settings ?? []) {
            if (!DROPPED_SETTINGS.has(key) && value !== undefined) {
                try {
                    result.settings[key] = JSON.stringify(value);
                } catch {
                    // not something that can be kept
                }
            }
        }
        return result;
    } finally {
        database.close();
    }
}
