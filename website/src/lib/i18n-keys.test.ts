// The keys of the translations that the code asks for have to exist, which nothing else checks:
// a missing key shows as the key itself.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { languages } from './languages';

const src = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return ['locales', 'docs'].includes(entry.name) ? [] : sources(path);
        }
        return /\.(ts|svelte)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
    });
}

function has(dictionary: any, key: string): boolean {
    let value = dictionary;
    for (const part of key.split('.')) {
        if (value === null || typeof value !== 'object' || !(part in value)) {
            return false;
        }
        value = value[part];
    }
    return typeof value === 'string';
}

function keysOf(dictionary: any, prefix = ''): string[] {
    return Object.entries(dictionary).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
            ? keysOf(value, `${prefix}${key}.`)
            : [`${prefix}${key}`]
    );
}

const english = JSON.parse(readFileSync(join(src, 'locales/en.json'), 'utf-8'));

describe('translations', () => {
    it('exist in english for every key that the code asks for', () => {
        const missing: string[] = [];
        let checked = 0;
        for (const file of sources(src)) {
            const code = readFileSync(file, 'utf-8');
            for (const match of code.matchAll(/i18n\._\(\s*(['"])([a-z0-9_.-]+)\1\s*[,)]/gi)) {
                checked++;
                if (!has(english, match[2])) {
                    missing.push(`${match[2]} (${file.replace(src, '')})`);
                }
            }
        }
        // the pattern does find the keys
        assert.ok(checked > 100, `${checked}`);
        assert.deepEqual(missing, []);
    });

    it('have no empty text in english', () => {
        const empty = keysOf(english).filter((key) => {
            const value = key.split('.').reduce((v: any, part) => v[part], english);
            return typeof value === 'string' && value.trim() === '';
        });
        assert.deepEqual(empty, []);
    });

    it('are valid JSON for every language of the site, with only keys that english has', () => {
        const known = new Set(keysOf(english));
        for (const language of Object.keys(languages)) {
            const dictionary = JSON.parse(
                readFileSync(join(src, `locales/${language}.json`), 'utf-8')
            );
            const unknown = keysOf(dictionary).filter((key) => !known.has(key));
            assert.deepEqual(unknown, [], language);
        }
    });
});
