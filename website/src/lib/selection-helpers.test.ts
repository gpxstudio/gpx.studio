import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Clipboard, FileStructure, Selection } from 'gpx-rs';
import type { VisibilityState } from './file-visibility';
import {
    elementId,
    hasSelectionWithin,
    isCovered,
    isInClipboard,
    isEmpty,
    isSelected,
    isSelectionHidden,
    selectedElementIds,
    selectedFileIds,
    selectionSize,
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

    it('gives the id of the element of a node', () => {
        assert.deepEqual(
            Object.keys(nodes).map((name) => elementId(nodes[name])),
            ['F1', 'F2', 'T1', 'T2', 'S1', 'S2', 'S3', 'F1:waypoints', 'W1', 'W2', 'F2:waypoints']
        );
    });

    it('tells which nodes are in the clipboard', () => {
        const clipboard = (type: Clipboard['type'], ids: string[]): Clipboard => ({
            type,
            ids,
            cut: true,
        });
        assert.deepEqual(
            matching(empty, (_, node) => isInClipboard(undefined, node)),
            []
        );
        const inClipboard = (c: Clipboard) =>
            Object.keys(nodes).filter((name) => isInClipboard(c, nodes[name]));
        assert.deepEqual(inClipboard(clipboard('files', ['F2'])), ['F2']);
        assert.deepEqual(inClipboard(clipboard('tracks', ['T2', 'S1'])), ['T2']);
        assert.deepEqual(inClipboard(clipboard('segments', ['S1', 'S3'])), ['S1', 'S3']);
        assert.deepEqual(inClipboard(clipboard('waypoints', ['W2'])), ['W2']);
        // not mixed up with the other kinds of elements
        assert.deepEqual(inClipboard(clipboard('files', ['T1', 'S1', 'W1'])), []);
    });

    it('counts the selected elements', () => {
        assert.equal(selectionSize(empty), 0);
        assert.equal(selectionSize(files('F1', 'F2')), 2);
        assert.equal(selectionSize(tracks('T1')), 1);
        assert.equal(selectionSize(segments('T1', 'S1', 'S2')), 2);
        assert.equal(selectionSize(waypoints), 1);
        assert.equal(selectionSize(waypoint('W1', 'W2')), 2);
    });

    it('lists the ids of the selected elements by file', () => {
        assert.deepEqual(selectedElementIds(empty), []);
        assert.deepEqual(selectedElementIds(files('F1', 'F2')), [
            { fileId: 'F1', ids: ['F1'] },
            { fileId: 'F2', ids: ['F2'] },
        ]);
        assert.deepEqual(selectedElementIds(tracks('T1', 'T2')), [
            { fileId: 'F1', ids: ['T1', 'T2'] },
        ]);
        assert.deepEqual(selectedElementIds(segments('T1', 'S1')), [{ fileId: 'F1', ids: ['S1'] }]);
        assert.deepEqual(selectedElementIds(waypoints), [{ fileId: 'F1', ids: ['F1:waypoints'] }]);
        assert.deepEqual(selectedElementIds(waypoint('W1')), [{ fileId: 'F1', ids: ['W1'] }]);
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

    describe('isSelectionHidden', () => {
        const segment = (id: string) => ({ id, rev: id, length: 2 });
        const structure: FileStructure = {
            id: 'F1',
            name: 'file',
            waypointsRev: 'rev',
            waypoints: [{ id: 'W1' }, { id: 'W2' }],
            tracks: [
                { id: 'T1', segments: [segment('S1'), segment('S2')] },
                { id: 'T2', segments: [segment('S3')] },
            ],
        };
        const states = (...hidden: string[]) =>
            new Map<string, VisibilityState>([
                [
                    'F1',
                    { structure, visibility: new Map(hidden.map((id) => [id, false] as const)) },
                ],
            ]);

        it('is false when nothing is selected', () => {
            assert.equal(isSelectionHidden(empty, states('F1')), false);
        });

        it('is true when everything selected is hidden', () => {
            assert.equal(isSelectionHidden(files('F1'), states('F1')), true);
            assert.equal(isSelectionHidden(tracks('T1', 'T2'), states('T1', 'T2')), true);
            // through a hidden parent
            assert.equal(isSelectionHidden(segments('T1', 'S1', 'S2'), states('T1')), true);
            assert.equal(isSelectionHidden(waypoint('W1', 'W2'), states('F1:waypoints')), true);
            assert.equal(isSelectionHidden(waypoints, states('F1:waypoints')), true);
        });

        it('is false as soon as one selected element is visible', () => {
            assert.equal(isSelectionHidden(files('F1'), states()), false);
            assert.equal(isSelectionHidden(tracks('T1', 'T2'), states('T1')), false);
            assert.equal(isSelectionHidden(waypoint('W1', 'W2'), states('W1')), false);
        });

        it('is false for files that are not known', () => {
            assert.equal(isSelectionHidden(files('F1', 'F2'), states('F1')), false);
        });
    });
});
