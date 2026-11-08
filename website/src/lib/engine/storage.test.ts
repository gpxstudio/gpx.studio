import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEGACY_IMPORTED_KEY, type LegacyData } from '$lib/storage/legacy-import';
import { openStoredFiles, type StorageHost } from '$lib/engine/storage';

// a channel would keep the tests running: there are no other tabs here
Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true });

const legacy: LegacyData = {
    files: [{ gpx: '<gpx/>', name: 'a' }],
    settings: { distanceUnits: '"imperial"', routing: 'false' },
};

type Options = {
    stored?: Record<string, string>;
    storedFiles?: number;
    loads?: boolean;
    writes?: boolean;
};

/** A host and a backend that note what is done, in order. */
function setup({ stored = {}, storedFiles = 0, loads = true, writes = true }: Options = {}) {
    const calls: string[] = [];
    const settings: Record<string, string> = { ...stored };
    let files = storedFiles;
    const host = {
        backend: {
            importsLegacyData: true,
            open_storage: async () => ({ settings: { ...stored }, outcome: {} }),
            flush_storage: async () => {
                calls.push('flush');
                return writes;
            },
            set_setting: async (key: string, value: string) => {
                calls.push(key);
                settings[key] = value;
            },
        },
        visibility: new Map(),
        // like the engine, what was stored is only known once this is done
        sync: async () => {
            await Promise.resolve();
            calls.push('sync');
        },
        outdated() {},
        hasFiles: () => calls.includes('sync') && files > 0,
        loadFiles: async () => {
            calls.push('load');
            if (loads) {
                files += 1;
            }
            return loads;
        },
        deselect: async () => true,
    } as unknown as StorageHost;
    return { host, calls, settings };
}

describe('importing the former database', () => {
    it('counts as done once the files are written', async () => {
        const { host, calls, settings } = setup();
        const opened = await openStoredFiles(host, async () => legacy);
        assert.deepEqual(calls, [
            'sync',
            'distanceUnits',
            'routing',
            'load',
            'flush',
            LEGACY_IMPORTED_KEY,
        ]);
        assert.equal(settings[LEGACY_IMPORTED_KEY], 'true');
        assert.equal(opened.distanceUnits, '"imperial"');
    });

    it('is tried again when the files cannot be loaded', async () => {
        const { host, settings } = setup({ loads: false });
        const opened = await openStoredFiles(host, async () => legacy);
        assert.equal(settings[LEGACY_IMPORTED_KEY], undefined);
        assert.equal(opened.distanceUnits, '"imperial"');
    });

    it('is tried again when the files cannot be written', async () => {
        const { host, settings } = setup({ writes: false });
        await openStoredFiles(host, async () => legacy);
        assert.equal(settings[LEGACY_IMPORTED_KEY], undefined);
    });

    it('is tried again when the database cannot be read', async () => {
        const { host, settings } = setup();
        await openStoredFiles(host, async () => {
            throw new Error('cannot read');
        });
        assert.equal(settings[LEGACY_IMPORTED_KEY], undefined);
    });

    it('keeps the settings that were changed since a previous try', async () => {
        const { host, settings } = setup({ stored: { routing: 'true' } });
        const opened = await openStoredFiles(host, async () => legacy);
        assert.equal(settings.routing, 'true');
        assert.equal(opened.routing, 'true');
        assert.equal(settings.distanceUnits, '"imperial"');
    });

    it('does not load the files twice: the stored ones mean it was done', async () => {
        const { host, calls, settings } = setup({ storedFiles: 3 });
        await openStoredFiles(host, async () => legacy);
        assert.ok(!calls.includes('load'));
        assert.equal(settings[LEGACY_IMPORTED_KEY], 'true');
    });

    it('is done when there is nothing to import, and only once', async () => {
        const nothing = setup();
        await openStoredFiles(nothing.host, async () => undefined);
        assert.equal(nothing.settings[LEGACY_IMPORTED_KEY], 'true');

        const done = setup({ stored: { [LEGACY_IMPORTED_KEY]: 'true' } });
        await openStoredFiles(done.host, async () => legacy);
        assert.ok(!done.calls.includes('load'));
    });
});
