import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeFileName, uniqueFileNames } from './file-names';

describe('sanitizeFileName', () => {
    it('keeps the names that are fine', () => {
        for (const name of [
            'Morning ride',
            'route-2024_05',
            'Café du coin',
            '日本の道',
            'a.b.c',
            '🚴 tour',
        ]) {
            assert.equal(sanitizeFileName(name), name);
        }
    });

    it('replaces what is not allowed in a name', () => {
        assert.equal(sanitizeFileName('a/b'), 'a_b');
        assert.equal(sanitizeFileName('a\\b'), 'a_b');
        assert.equal(sanitizeFileName('../../etc/passwd'), '_.._etc_passwd');
        assert.equal(
            sanitizeFileName('what? <this> *is* "it": a|b'),
            'what_ _this_ _is_ _it__ a_b'
        );
        assert.equal(sanitizeFileName('tab\there\nnew\u0000line\u007f'), 'tab_here_new_line_');
    });

    it('has no dots or spaces around, which systems drop or hide', () => {
        assert.equal(sanitizeFileName('  name  '), 'name');
        assert.equal(sanitizeFileName('.hidden'), 'hidden');
        assert.equal(sanitizeFileName('name...'), 'name');
        assert.equal(sanitizeFileName('. . name . .'), 'name');
    });

    it('is never empty', () => {
        assert.equal(sanitizeFileName(''), 'file');
        assert.equal(sanitizeFileName('   '), 'file');
        assert.equal(sanitizeFileName('...'), 'file');
    });

    it('does not use the names Windows keeps for devices', () => {
        assert.equal(sanitizeFileName('con'), '_con');
        assert.equal(sanitizeFileName('NUL'), '_NUL');
        assert.equal(sanitizeFileName('com1'), '_com1');
        assert.equal(sanitizeFileName('LPT9'), '_LPT9');
        assert.equal(sanitizeFileName('aux.backup'), '_aux.backup');
        assert.equal(sanitizeFileName('console'), 'console');
        assert.equal(sanitizeFileName('com10'), 'com10');
    });

    it('is not too long, whatever the characters', () => {
        assert.equal(sanitizeFileName('a'.repeat(500)).length, 100);
        const emoji = sanitizeFileName('🚴'.repeat(500));
        assert.equal([...emoji].length, 100);
        // and does not end with what was left of a cut
        assert.equal(sanitizeFileName('a'.repeat(99) + '. b'), 'a'.repeat(99));
    });

    it('is the same when sanitized again', () => {
        for (const name of ['a/b', '  .x  ', 'con', '', '🚴'.repeat(200), 'what?']) {
            const once = sanitizeFileName(name);
            assert.equal(sanitizeFileName(once), once);
        }
    });
});

describe('uniqueFileNames', () => {
    it('keeps different names as they are', () => {
        assert.deepEqual(uniqueFileNames(['a', 'b', 'c']), ['a', 'b', 'c']);
        assert.deepEqual(uniqueFileNames([]), []);
    });

    it('numbers the names that are taken', () => {
        assert.deepEqual(uniqueFileNames(['ride', 'ride', 'ride']), ['ride', 'ride-1', 'ride-2']);
        // a name that looks like a number is taken too
        assert.deepEqual(uniqueFileNames(['ride-1', 'ride', 'ride']), ['ride-1', 'ride', 'ride-2']);
    });

    it('does not tell upper and lower case apart', () => {
        assert.deepEqual(uniqueFileNames(['Ride', 'ride', 'RIDE']), ['Ride', 'ride-1', 'RIDE-2']);
    });

    it('compares the names once they are clean', () => {
        assert.deepEqual(uniqueFileNames(['a/b', 'a_b', 'a?b']), ['a_b', 'a_b-1', 'a_b-2']);
        assert.deepEqual(uniqueFileNames(['', '', '...']), ['file', 'file-1', 'file-2']);
    });

    it('keeps the numbered names short enough', () => {
        const long = 'x'.repeat(300);
        const names = uniqueFileNames([long, long, long]);
        assert.equal(new Set(names).size, 3);
        assert.ok(names.every((name) => name.length <= 100));
        assert.ok(names[1].endsWith('-1') && names[2].endsWith('-2'));
    });
});
