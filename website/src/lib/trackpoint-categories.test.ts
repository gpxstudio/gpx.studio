import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categoryAt } from './trackpoint-categories';

describe('categoryAt', () => {
    const codes = new Uint8Array([1, 1, 0, 2, 0]);
    const names = ['asphalt', 'gravel'];

    it('is the name of the code', () => {
        assert.equal(categoryAt(codes, names, 0), 'asphalt');
        assert.equal(categoryAt(codes, names, 3), 'gravel');
    });

    it('is undefined when the value is unknown', () => {
        assert.equal(categoryAt(codes, names, 2), undefined);
        assert.equal(categoryAt(codes, names, 4), undefined);
    });

    it('is undefined out of the trackpoints, or for a code without name', () => {
        assert.equal(categoryAt(codes, names, 5), undefined);
        assert.equal(categoryAt(new Uint8Array([3]), names, 0), undefined);
        assert.equal(categoryAt(new Uint8Array(), [], 0), undefined);
    });
});
