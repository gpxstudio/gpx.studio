import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FileStructure } from 'gpx-rs';
import {
    isHidden,
    isSegmentHidden,
    isWaypointHidden,
    parseVisibility,
    setHidden,
    stringifyVisibility,
    waypointsKey,
    type Visibility,
    type VisibilityState,
} from './file-visibility';

const segment = (id: string) => ({ id, rev: `rev-${id}`, length: 2 });

// F
// ├── waypoints: W1, W2
// ├── T1: S1, S2
// └── T2: S3
const structure: FileStructure = {
    id: 'F',
    name: 'file',
    waypointsRev: 'wpt-rev',
    waypoints: [{ id: 'W1' }, { id: 'W2' }],
    tracks: [
        { id: 'T1', segments: [segment('S1'), segment('S2')] },
        { id: 'T2', segments: [segment('S3')] },
    ],
};
const WPTS = waypointsKey('F');
const elements = ['F', WPTS, 'W1', 'W2', 'T1', 'S1', 'S2', 'T2', 'S3'];

/** Applies the actions one after the other, starting with everything visible. */
function apply(...actions: [ids: string[], hidden: boolean][]): VisibilityState {
    let visibility: Visibility = new Map();
    for (const [ids, hidden] of actions) {
        visibility = setHidden(structure, visibility, ids, hidden);
    }
    return { structure, visibility };
}

function hiddenElements(state: VisibilityState): string[] {
    return elements.filter((id) => isHidden(state, id));
}

describe('file visibility', () => {
    it('shows everything by default', () => {
        assert.deepEqual(hiddenElements(apply()), []);
    });

    it('hides an element and what is below it', () => {
        assert.deepEqual(hiddenElements(apply([['T1'], true])), ['T1', 'S1', 'S2']);
        assert.deepEqual(hiddenElements(apply([['S1'], true])), ['S1']);
        assert.deepEqual(hiddenElements(apply([[WPTS], true])), [WPTS, 'W1', 'W2']);
        assert.deepEqual(hiddenElements(apply([['W2'], true])), ['W2']);
    });

    it('hides a whole file', () => {
        assert.deepEqual(hiddenElements(apply([['F'], true])), elements);
    });

    it('shows again what was hidden', () => {
        assert.deepEqual(hiddenElements(apply([['F'], true], [['F'], false])), []);
        assert.deepEqual(hiddenElements(apply([['S1'], true], [['S1'], false])), []);
    });

    it('keeps the other segments hidden when one is shown below a hidden file', () => {
        const state = apply([['F'], true], [['S1'], false]);
        assert.deepEqual(hiddenElements(state), [WPTS, 'W1', 'W2', 'S2', 'T2', 'S3']);
        // the file and the track of the visible segment are not hidden, they have visible content
        assert.equal(isHidden(state, 'F'), false);
        assert.equal(isHidden(state, 'T1'), false);
        assert.equal(isHidden(state, 'S1'), false);
    });

    it('hides the file again once what was shown is hidden', () => {
        const state = apply([['F'], true], [['S1'], false], [['S1'], true]);
        assert.deepEqual(hiddenElements(state), elements);
    });

    it('resets what was shown below when hiding a parent', () => {
        const state = apply([['F'], true], [['S1'], false], [['F'], true]);
        assert.deepEqual(hiddenElements(state), elements);
        assert.equal(state.visibility.has('S1'), false);
    });

    it('resets what was hidden below when showing a parent', () => {
        const state = apply([['S1', 'S3', 'W1'], true], [['F'], false]);
        assert.deepEqual(hiddenElements(state), []);
        assert.equal(state.visibility.has('S1'), false);
    });

    it('shows a track hidden below a hidden file, with all its segments', () => {
        const state = apply([['F'], true], [['T1'], false]);
        assert.deepEqual(hiddenElements(state), [WPTS, 'W1', 'W2', 'T2', 'S3']);
    });

    it('shows a waypoint below a hidden file', () => {
        const state = apply([['F'], true], [['W1'], false]);
        assert.deepEqual(hiddenElements(state), ['W2', 'T1', 'S1', 'S2', 'T2', 'S3']);
        assert.equal(isHidden(state, WPTS), false);
        assert.equal(isHidden(state, 'F'), false);
    });

    it('hides a segment shown inside a hidden track of a visible file', () => {
        const state = apply([['T1'], true], [['S2'], false]);
        assert.deepEqual(hiddenElements(state), ['S1']);
    });

    it('does not touch the other branches of the tree', () => {
        const state = apply([['T1'], true], [['T2'], true], [['T1'], false]);
        assert.deepEqual(hiddenElements(state), ['T2', 'S3']);
    });

    it('has leaf helpers agreeing with isHidden', () => {
        const states = [
            apply(),
            apply([['F'], true]),
            apply([['F'], true], [['S1'], false], [['W2'], false]),
            apply([['T1'], true], [['S2'], false]),
            apply([[WPTS], true], [['W1'], false]),
        ];
        for (const state of states) {
            for (const track of structure.tracks) {
                for (const { id } of track.segments) {
                    assert.equal(isSegmentHidden(state, track.id, id), isHidden(state, id));
                }
            }
            for (const { id } of structure.waypoints) {
                assert.equal(isWaypointHidden(state, id), isHidden(state, id));
            }
        }
    });

    it('does not consider unknown ids hidden', () => {
        assert.equal(isHidden(apply([['F'], true]), 'unknown'), false);
    });

    it('does not mutate the previous visibility', () => {
        const before: Visibility = new Map([['S1', false]]);
        setHidden(structure, before, ['F'], true);
        assert.deepEqual([...before], [['S1', false]]);
    });
});

describe('kept visibility', () => {
    const visibility = (entries: [string, boolean][]): Visibility => new Map(entries);

    it('comes back as it was kept', () => {
        const files = new Map([
            [
                'F',
                visibility([
                    ['F', false],
                    ['S1', true],
                    [WPTS, false],
                ]),
            ],
            ['G', visibility([['G', false]])],
        ]);
        const json = stringifyVisibility(files, () => true);
        assert.deepEqual(parseVisibility(json), files);
    });

    it('leaves out the files that are gone and the ones with nothing set', () => {
        const files = new Map([
            ['F', visibility([['F', false]])],
            ['G', visibility([['G', false]])],
            ['H', visibility([])],
        ]);
        const json = stringifyVisibility(files, (fileId) => fileId !== 'G');
        assert.deepEqual([...parseVisibility(json).keys()], ['F']);
    });

    it('is nothing when there is nothing to keep', () => {
        assert.equal(
            stringifyVisibility(new Map(), () => true),
            undefined
        );
        assert.equal(
            stringifyVisibility(new Map([['F', visibility([['F', false]])]]), () => false),
            undefined
        );
        assert.equal(parseVisibility(undefined).size, 0);
    });

    it('ignores what is not visibility', () => {
        assert.equal(parseVisibility('not json').size, 0);
        assert.equal(parseVisibility('3').size, 0);
        assert.equal(parseVisibility('null').size, 0);
        const parsed = parseVisibility('{"F":{"F":false,"S1":"no"},"G":3,"H":{}}');
        assert.deepEqual([...parsed.keys()], ['F']);
        assert.deepEqual([...parsed.get('F')!], [['F', false]]);
    });
});
