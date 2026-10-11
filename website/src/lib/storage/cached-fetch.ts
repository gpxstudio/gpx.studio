/**
 * `fetch` that keeps the responses in the Cache API, which the browser does whatever the headers
 * of the server are: the HTTP cache needs them to keep a response (and `cache: 'force-cache'`
 * can only use what it kept). A kept response is used until it is older than `maxAge`.
 *
 * It works without the Cache API (insecure pages, private windows, blocked storage): the
 * responses are then just not kept.
 */

export type CachedFetchOptions = {
    /** Name of the cache the responses are kept in. */
    name: string;
    /** How long a kept response is used, in milliseconds. */
    maxAge: number;
};

/** When a response was kept (ms since the epoch): the server's date can be wrong or missing. */
const KEPT_AT = 'x-kept-at';

/** The caches that were cleaned of their old responses in this session. */
const pruned = new Set<string>();

async function openCache(name: string): Promise<Cache | undefined> {
    try {
        return typeof caches === 'undefined' ? undefined : await caches.open(name);
    } catch {
        return undefined;
    }
}

function age(response: Response): number {
    const keptAt = Number(response.headers.get(KEPT_AT));
    return keptAt > 0 ? Date.now() - keptAt : Infinity;
}

/** Deletes the responses that are too old to be used. */
export async function pruneCache({ name, maxAge }: CachedFetchOptions) {
    const cache = await openCache(name);
    if (!cache) {
        return;
    }
    try {
        for (const request of await cache.keys()) {
            const response = await cache.match(request);
            if (!response || !(age(response) < maxAge)) {
                await cache.delete(request);
            }
        }
    } catch {
        // what is left is cleaned another time
    }
}

/**
 * The response for `url`: the kept one if there is one that is not too old, otherwise the one of
 * the network, which is kept if it is successful.
 */
export async function cachedFetch(url: string, options: CachedFetchOptions): Promise<Response> {
    const cache = await openCache(options.name);
    if (cache && !pruned.has(options.name)) {
        pruned.add(options.name);
        void pruneCache(options);
    }

    try {
        const kept = await cache?.match(url);
        if (kept && age(kept) < options.maxAge) {
            return kept;
        }
    } catch {
        // as if there was nothing
    }

    const response = await fetch(url);
    if (!response.ok || !cache) {
        return response;
    }

    const headers = new Headers(response.headers);
    headers.set(KEPT_AT, String(Date.now()));
    const stamped = new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
    // best effort: the storage can be full
    cache.put(url, stamped.clone()).catch(() => undefined);
    return stamped;
}
