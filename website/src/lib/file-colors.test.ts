import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FileColorAllocator, normalizeColor } from './file-colors';

describe('normalizeColor', () => {
    it('adds the # of hex colors that have none', () => {
        assert.equal(normalizeColor('ff0000'), '#ff0000');
        assert.equal(normalizeColor('FF00aa'), '#FF00aa');
        assert.equal(normalizeColor('#ff0000'), '#ff0000');
        assert.equal(normalizeColor('red'), 'red');
        assert.equal(normalizeColor('fff'), 'fff');
        assert.equal(normalizeColor('hsl(0, 70%, 50%)'), 'hsl(0, 70%, 50%)');
    });
});

describe('FileColorAllocator', () => {
    it('uses the color the tracks define', () => {
        const colors = new FileColorAllocator();
        assert.equal(colors.resolve('a', [undefined, 'ff9900', '0000ff']), '#ff9900');
        assert.equal(colors.resolve('b', ['#123456']), '#123456');
    });

    it('gives the files different palette colors while some are unused', () => {
        const colors = new FileColorAllocator();
        const given = Array.from({ length: 11 }, (_, i) => colors.resolve(`file-${i}`, []));
        assert.equal(new Set(given).size, 11);
        // then the least used ones again
        const twelfth = colors.resolve('file-11', []);
        assert.equal(twelfth, given[0]);
    });

    it('keeps the color of a file when its style comes and goes', () => {
        const colors = new FileColorAllocator();
        const palette = colors.resolve('a', []);
        colors.resolve('b', []);
        // a style is defined, then removed (edit, undo): the file gets its color back
        assert.equal(colors.resolve('a', ['ff0000']), '#ff0000');
        assert.equal(colors.resolve('a', []), palette);
        assert.equal(colors.resolve('a', [undefined]), palette);
    });

    it('does not count the colors files define as used palette colors twice', () => {
        const colors = new FileColorAllocator();
        const first = colors.resolve('a', []);
        // a file with the color of the palette uses it
        colors.resolve('b', [first]);
        const next = colors.resolve('c', []);
        assert.notEqual(next, first);
    });

    it('frees the colors of the files that go away', () => {
        const colors = new FileColorAllocator();
        const a = colors.resolve('a', []);
        const b = colors.resolve('b', []);
        assert.notEqual(a, b);
        colors.release('a');
        // a color that nobody uses is picked first again
        assert.equal(colors.resolve('c', []), a);
        // and a file that comes back gets a color again
        colors.release('b');
        colors.resolve('b', []);
    });
});
