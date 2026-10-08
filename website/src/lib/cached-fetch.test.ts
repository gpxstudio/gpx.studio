import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { cachedFetch, pruneCache } from './cached-fetch';

const keyOf = (request: RequestInfo | URL) =>
    request instanceof Request ? request.url : String(request);

/** A Cache API in memory: only what `cachedFetch` uses. */
class FakeCache {
    entries = new Map<string, Response>();
    failToPut = false;

    async match(request: RequestInfo | URL) {
        return this.entries.get(keyOf(request))?.clone();
    }

    async put(request: RequestInfo | URL, response: Response) {
        if (this.failToPut) {
            throw new Error('quota');
        }
        this.entries.set(keyOf(request), response);
    }

    async delete(request: RequestInfo | URL) {
        return this.entries.delete(keyOf(request));
    }

    async keys() {
        return [...this.entries.keys()].map((url) => new Request(url));
    }
}

const global = globalThis as unknown as { caches?: unknown; fetch: unknown };
const original = { caches: global.caches, fetch: global.fetch };

describe('cachedFetch', () => {
    let cache: FakeCache;
    let fetched: string[];
    let names: string[];
    let options: { name: string; maxAge: number };
    let counter = 0;

    beforeEach(() => {
        cache = new FakeCache();
        fetched = [];
        names = [];
        // the caches are cleaned once per session and name: a new name for each test
        options = { name: `test-${counter++}`, maxAge: 60_000 };
        global.caches = {
            open: async (name: string) => {
                names.push(name);
                return cache;
            },
        };
        global.fetch = async (url: string) => {
            fetched.push(url);
            return new Response(JSON.stringify({ url }), {
                status: url.includes('missing') ? 404 : 200,
            });
        };
    });

    afterEach(() => {
        global.caches = original.caches;
        global.fetch = original.fetch;
        mock.timers.reset();
    });

    it('asks the network once, then uses what it kept', async () => {
        const first = await cachedFetch('https://example.com/a', options);
        assert.deepEqual(await first.json(), { url: 'https://example.com/a' });
        const second = await cachedFetch('https://example.com/a', options);
        assert.deepEqual(await second.json(), { url: 'https://example.com/a' });
        assert.deepEqual(fetched, ['https://example.com/a']);
        assert.ok(names.every((name) => name === options.name));

        await cachedFetch('https://example.com/b', options);
        assert.equal(fetched.length, 2);
    });

    it('asks the network again for what is too old, and keeps the new response', async () => {
        mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
        await cachedFetch('https://example.com/a', options);
        mock.timers.setTime(1_000_000 + options.maxAge - 1);
        await cachedFetch('https://example.com/a', options);
        assert.equal(fetched.length, 1);

        mock.timers.setTime(1_000_000 + options.maxAge);
        await cachedFetch('https://example.com/a', options);
        assert.equal(fetched.length, 2);
        // the new one is the one that is kept: it is not too old a minute later
        mock.timers.setTime(1_000_000 + options.maxAge + 30_000);
        await cachedFetch('https://example.com/a', options);
        assert.equal(fetched.length, 2);
    });

    it('does not keep what failed', async () => {
        const response = await cachedFetch('https://example.com/missing', options);
        assert.equal(response.status, 404);
        assert.equal(cache.entries.size, 0);
        await cachedFetch('https://example.com/missing', options);
        assert.equal(fetched.length, 2);
    });

    it('answers even if the response cannot be kept', async () => {
        cache.failToPut = true;
        const response = await cachedFetch('https://example.com/a', options);
        assert.deepEqual(await response.json(), { url: 'https://example.com/a' });
        // let the failed put settle: it must not throw
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('works without the Cache API', async () => {
        global.caches = undefined;
        const response = await cachedFetch('https://example.com/a', options);
        assert.deepEqual(await response.json(), { url: 'https://example.com/a' });
        await cachedFetch('https://example.com/a', options);
        assert.equal(fetched.length, 2);
    });

    it('works when the Cache API cannot be opened', async () => {
        global.caches = {
            open: async () => {
                throw new Error('blocked');
            },
        };
        const response = await cachedFetch('https://example.com/a', options);
        assert.equal(response.status, 200);
    });

    it('cleans what is too old', async () => {
        mock.timers.enable({ apis: ['Date'], now: 5_000_000 });
        await cachedFetch('https://example.com/old', options);
        mock.timers.setTime(5_000_000 + options.maxAge / 2);
        await cachedFetch('https://example.com/recent', options);
        // a response that was kept by something else is not trusted
        await cache.put('https://example.com/foreign', new Response('{}'));

        mock.timers.setTime(5_000_000 + options.maxAge + 1);
        await pruneCache(options);
        assert.deepEqual([...cache.entries.keys()], ['https://example.com/recent']);
    });
});
