import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { languages } from '$lib/languages';
import { getNextGuide, getPreviousGuide, guides } from './guides';

/** Every page of the help in reading order, as the links at the bottom of the pages follow them. */
const pages = Object.entries(guides).flatMap(([guide, subguides]) => [
    guide,
    ...subguides.map((subguide) => `${guide}/${subguide}`),
]);

describe('guides', () => {
    it('go from one page to the next, subguides included', () => {
        assert.equal(getNextGuide('getting-started'), 'menu');
        assert.equal(getNextGuide('menu'), 'menu/file');
        assert.equal(getNextGuide('menu/file'), 'menu/edit');
        assert.equal(getNextGuide('menu/settings'), 'files-and-stats');
        assert.equal(getNextGuide('toolbar/clean'), 'map-controls');
        assert.equal(getNextGuide('integration'), 'faq');
    });

    it('go from one page to the previous one, subguides included', () => {
        assert.equal(getPreviousGuide('menu'), 'getting-started');
        assert.equal(getPreviousGuide('menu/file'), 'menu');
        assert.equal(getPreviousGuide('menu/edit'), 'menu/file');
        assert.equal(getPreviousGuide('files-and-stats'), 'menu/settings');
        assert.equal(getPreviousGuide('map-controls'), 'toolbar/clean');
        assert.equal(getPreviousGuide('faq'), 'integration');
    });

    it('stop at the ends', () => {
        assert.equal(getPreviousGuide('getting-started'), undefined);
        assert.equal(getNextGuide('faq'), undefined);
    });

    it('know nothing of pages that do not exist', () => {
        assert.equal(getNextGuide('nope'), undefined);
        assert.equal(getNextGuide('nope/sub'), undefined);
        assert.equal(getPreviousGuide('nope'), undefined);
        assert.equal(getPreviousGuide('nope/sub'), undefined);
    });

    it('walk through every page in both directions', () => {
        const forward = [pages[0]];
        for (let next = getNextGuide(pages[0]); next; next = getNextGuide(next)) {
            forward.push(next);
        }
        assert.deepEqual(forward, pages);

        const backward = [pages.at(-1)!];
        for (
            let previous = getPreviousGuide(pages.at(-1)!);
            previous;
            previous = getPreviousGuide(previous)
        ) {
            backward.push(previous);
        }
        assert.deepEqual(backward.reverse(), pages);
    });

    it('are written in every language of the site', () => {
        const root = new URL('../../docs/', import.meta.url);
        const missing: string[] = [];
        for (const language of Object.keys(languages)) {
            for (const page of pages) {
                if (!existsSync(new URL(`${language}/${page}.mdx`, root))) {
                    missing.push(`${language}/${page}`);
                }
            }
        }
        assert.deepEqual(missing, []);
    });

    it('have a translation of the interface for every language of the site', () => {
        const root = new URL('../../../locales/', import.meta.url);
        for (const language of Object.keys(languages)) {
            assert.ok(existsSync(new URL(`${language}.json`, root)), language);
        }
    });
});
