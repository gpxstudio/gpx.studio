import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rowHeight, stickyRowStyle } from './sticky';

describe('stickyRowStyle', () => {
    it('puts each row under the ones of the folders it is in', () => {
        assert.match(stickyRowStyle(0), /top: 0px/);
        assert.match(stickyRowStyle(2), new RegExp(`top: ${2 * rowHeight}px`));
    });

    it('puts the rows of the folders above over the rows below', () => {
        const zIndex = (depth: number) => Number(/z-index: (\d+)/.exec(stickyRowStyle(depth))![1]);
        assert.ok(zIndex(0) > zIndex(1));
        assert.ok(zIndex(1) > zIndex(5));
        assert.ok(zIndex(500) >= 1);
    });
});
