import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Selection } from 'gpx-rs';
import {
    hasSelectionWithin,
    isCovered,
    isEmpty,
    isSelected,
    selectedFileIds,
    type FileTreeNode,
} from './selection-helpers';

// Two files; F1 has the tracks T1 (segments S1, S2) and T2 (segment S3), and waypoints W1, W2.
const nodes: Record<string, FileTreeNode> = {
    F1: { type: 'file', fileId: 'F1' },
    F2: { type: 'file', fileId: 'F2' },
    T1: { type: 'track', fileId: 'F1', trackId: 'T1' },
    T2: { type: 'track', fileId: 'F1', trackId: 'T2' },
    S1: { type: 'segment', fileId: 'F1', trackId: 'T1', segmentId: 'S1' },
    S2: { type: 'segment', fileId: 'F1', trackId: 'T1', segmentId: 'S2' },
    S3: { type: 'segment', fileId: 'F1', trackId: 'T2', segmentId: 'S3' },
    WPTS: { type: 'waypoints', fileId: 'F1' },
    W1: { type: 'waypoint', fileId: 'F1', waypointId: 'W1' },
    W2: { type: 'waypoint', fileId: 'F1', waypointId: 'W2' },
    // same ids in another file
    F2_WPTS: { type: 'waypoints', fileId: 'F2' },
};

const empty: Selection = { type: 'empty' };
const files = (...fileIds: string[]): Selection => ({ type: 'file', fileIds });
const tracks = (...trackIds: string[]): Selection => ({ type: 'track', fileId: 'F1', trackIds });
const segments = (trackId: string, ...segmentIds: string[]): Selection => ({
    type: 'segment',
    fileId: 'F1',
    trackId,
    segmentIds,
});
const waypoints: Selection = { type: 'waypoints', fileId: 'F1' };
const waypoint = (...waypointIds: string[]): Selection => ({
    type: 'waypoint',
    fileId: 'F1',
    waypointIds,
});

/** The names of the nodes for which `predicate` holds, to compare with what is expected. */
function matching(selection: Selection, predicate: typeof isSelected): string[] {
    return Object.keys(nodes).filter((name) => predicate(selection, nodes[name]));
}

describe('selection helpers', () => {
    it('tells whether the selection is empty', () => {
        assert.equal(isEmpty(empty), true);
        assert.equal(isEmpty(files('F1')), false);
        assert.equal(isEmpty(waypoints), false);
    });

    it('lists the files holding something selected', () => {
        assert.deepEqual(selectedFileIds(empty), []);
        assert.deepEqual(selectedFileIds(files('F1', 'F2')), ['F1', 'F2']);
        assert.deepEqual(selectedFileIds(tracks('T1')), ['F1']);
        assert.deepEqual(selectedFileIds(segments('T1', 'S1')), ['F1']);
        assert.deepEqual(selectedFileIds(waypoints), ['F1']);
        assert.deepEqual(selectedFileIds(waypoint('W1')), ['F1']);
    });

    describe('isSelected', () => {
        it('matches the selected nodes only', () => {
            assert.deepEqual(matching(empty, isSelected), []);
            assert.deepEqual(matching(files('F1', 'F2'), isSelected), ['F1', 'F2']);
            assert.deepEqual(matching(tracks('T1', 'T2'), isSelected), ['T1', 'T2']);
            assert.deepEqual(matching(segments('T1', 'S1'), isSelected), ['S1']);
            assert.deepEqual(matching(waypoints, isSelected), ['WPTS']);
            assert.deepEqual(matching(waypoint('W2'), isSelected), ['W2']);
        });

        it('does not mix up the track of a segment, nor the file', () => {
            // S3 belongs to T2: selecting "S3 of T1" does not select it
            assert.equal(isSelected(segments('T1', 'S3'), nodes.S3), false);
            assert.equal(isSelected(files('F2'), nodes.F1), false);
        });
    });

    describe('isCovered', () => {
        it('covers everything below a selected file', () => {
            assert.deepEqual(
                matching(files('F1'), isCovered),
                Object.keys(nodes).filter((name) => name !== 'F2' && name !== 'F2_WPTS')
            );
        });

        it('covers the segments of a selected track, not its siblings', () => {
            assert.deepEqual(matching(tracks('T1'), isCovered), ['T1', 'S1', 'S2']);
        });

        it('covers the waypoints below the waypoints node', () => {
            assert.deepEqual(matching(waypoints, isCovered), ['WPTS', 'W1', 'W2']);
        });

        it('does not cover parents, siblings or the other files', () => {
            assert.deepEqual(matching(segments('T1', 'S1'), isCovered), ['S1']);
            assert.deepEqual(matching(waypoint('W1'), isCovered), ['W1']);
            assert.deepEqual(matching(empty, isCovered), []);
        });
    });

    describe('hasSelectionWithin', () => {
        it('looks at the descendants of a file, whatever their kind', () => {
            for (const selection of [
                files('F1'),
                tracks('T1'),
                segments('T1', 'S1'),
                waypoints,
                waypoint('W1'),
            ]) {
                assert.equal(hasSelectionWithin(selection, nodes.F1), true);
                assert.equal(hasSelectionWithin(selection, nodes.F2), false);
            }
            assert.equal(hasSelectionWithin(empty, nodes.F1), false);
        });

        it('looks at the segments of a track', () => {
            assert.deepEqual(matching(tracks('T1'), hasSelectionWithin), ['F1', 'T1']);
            assert.deepEqual(matching(segments('T1', 'S2'), hasSelectionWithin), [
                'F1',
                'T1',
                'S2',
            ]);
        });

        it('looks at the waypoints below the waypoints node', () => {
            assert.deepEqual(matching(waypoints, hasSelectionWithin), ['F1', 'WPTS']);
            assert.deepEqual(matching(waypoint('W1'), hasSelectionWithin), ['F1', 'WPTS', 'W1']);
        });

        it('does not look at ancestors', () => {
            // a selected file does not mean that its segments hold a selection
            assert.deepEqual(matching(files('F1'), hasSelectionWithin), ['F1']);
        });
    });
});
