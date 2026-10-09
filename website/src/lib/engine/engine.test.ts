// The frontend side of the engine, against the real engine (the WASM module of `gpx-rs`, which has
// to be built: `wasm-pack build wasm --target bundler --out-dir ../pkg` in `gpx-rs`).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { isHidden } from '$lib/file-visibility';
import {
    ALL_EXPORT_OPTIONS,
    engine,
    FileStateCollectionObserver,
    NO_TIME,
    type ExportOptions,
    type FileState,
} from '$lib/engine';

function fixture(name: string): Uint8Array {
    return new Uint8Array(
        readFileSync(new URL(`../../../../gpx-rs/engine/data/${name}.gpx`, import.meta.url))
    );
}

async function load(...names: string[]) {
    return engine.loadFiles(names.map((name) => ({ data: fixture(name), name })));
}

function fileStates(): FileState[] {
    return [...get(engine.files).values()].map((store) => get(store));
}

function lastError() {
    return get(engine.lastError);
}

beforeEach(async () => {
    await engine.ready;
    await engine.deleteAll();
});

describe('files', () => {
    it('creates a file, selects it, and can take it back', async () => {
        assert.equal(await engine.newFile('route'), true);
        const [id] = get(engine.order);
        assert.equal(get(engine.order).length, 1);
        assert.equal(get(get(engine.files).get(id)!).structure.name, 'route');
        assert.deepEqual(get(engine.selection), { type: 'file', fileIds: [id] });
        assert.equal(get(engine.canUndo), true);

        await engine.undo();
        assert.deepEqual(get(engine.order), []);
        assert.equal(get(engine.files).size, 0);
        assert.equal(get(engine.canRedo), true);
        await engine.redo();
        assert.deepEqual(get(engine.order), [id]);
    });

    it('starts a new file with a track when given a trackpoint', async () => {
        await engine.newFile('start', { lng: 4.4, lat: 50.8, ele: 120 });
        const file = fileStates()[0];
        assert.equal(file.structure.tracks.length, 1);
        assert.equal(file.segments.features.length, 1);
        assert.deepEqual(file.segments.features[0].geometry.coordinates, [[4.4, 50.8]]);
        assert.equal(get(engine.statistics).length, 1);
        assert.equal(get(engine.statistics).ele[0], 120);
    });

    it('loads several files in one undo step and selects the first one', async () => {
        assert.equal(await load('simple', 'with_tracks'), true);
        const ids = get(engine.order);
        assert.equal(ids.length, 2);
        assert.deepEqual(get(engine.selection), { type: 'file', fileIds: [ids[0]] });
        // the names of the files are the ones of the data, or the given ones
        assert.deepEqual(
            fileStates().map((file) => file.structure.name),
            ['simple', 'with_tracks']
        );

        await engine.undo();
        assert.equal(get(engine.files).size, 0);
    });

    it('skips what cannot be read, and tells why when nothing could', async () => {
        const broken = { data: new TextEncoder().encode('<gpx><trk></gpx>'), name: 'broken' };
        assert.equal(await engine.loadFiles([broken]), false);
        assert.match(lastError() ?? '', /^invalid data/);
        assert.equal(get(engine.files).size, 0);

        assert.equal(
            await engine.loadFiles([broken, { data: fixture('simple'), name: 'ok' }]),
            true
        );
        assert.equal(get(engine.files).size, 1);
        assert.equal(lastError(), undefined);
    });

    it('duplicates and deletes the selection', async () => {
        await load('simple');
        await engine.duplicate();
        assert.equal(get(engine.order).length, 2);
        const [original, copy] = get(engine.order);
        assert.notEqual(original, copy);

        await engine.delete();
        assert.equal(get(engine.files).size, 1);
        assert.equal(await engine.deleteAll(), true);
        assert.equal(await engine.deleteAll(), false);
        assert.equal(lastError(), 'nothing to do');
    });

    it('reorders the files', async () => {
        await load('simple', 'with_tracks', 'with_waypoint');
        const [a, b, c] = get(engine.order);
        await engine.reorder([c], 0);
        assert.deepEqual(get(engine.order), [c, a, b]);
        assert.equal(get(engine.canUndo), true);
        // an order is not an edit: only the loading is undone
        await engine.undo();
        assert.equal(get(engine.files).size, 0);
    });
});

describe('errors', () => {
    it('keeps the reason of the last call that did nothing', async () => {
        assert.equal(lastError(), 'nothing to do');
        await engine.newFile('a');
        assert.equal(lastError(), undefined);

        await engine.select([]);
        assert.equal(await engine.reverse(), false);
        assert.equal(lastError(), 'nothing to do');
        // a call with wrong arguments says so
        assert.equal(await engine.crop(5, 1), false);
        assert.match(lastError() ?? '', /reversed/);
        // the next success clears it
        assert.equal(await engine.newFile('b'), true);
        assert.equal(lastError(), undefined);
    });

    it('refuses a stale routing revision', async () => {
        await engine.newFile('a', { lng: 4, lat: 50 });
        assert.equal(await engine.insertAnchor(-1, 4, 50), false);
        assert.match(lastError() ?? '', /selection changed/);
    });
});

describe('selection', () => {
    it('adds and toggles files', async () => {
        await load('simple', 'with_tracks', 'with_waypoint');
        const [a, b, c] = get(engine.order);
        await engine.select([a]);
        await engine.select([b], 'add');
        assert.deepEqual(new Set((get(engine.selection) as any).fileIds), new Set([a, b]));
        await engine.select([a], 'toggle');
        assert.deepEqual((get(engine.selection) as any).fileIds, [b]);
        await engine.select([]);
        assert.deepEqual(get(engine.selection), { type: 'empty' });

        assert.equal(await engine.selectAll(), true);
        assert.deepEqual(new Set((get(engine.selection) as any).fileIds), new Set([a, b, c]));
    });

    it('selects tracks and segments of a file', async () => {
        await load('with_tracks_and_segments');
        const file = fileStates()[0];
        const track = file.structure.tracks[0];
        await engine.selectTracks(file.structure.id, [track.id]);
        assert.deepEqual(get(engine.selection), {
            type: 'track',
            fileId: file.structure.id,
            trackIds: [track.id],
        });
        // the statistics follow the selection
        const trackLength = get(engine.statistics).length;
        assert.ok(trackLength > 0);
        await engine.select([file.structure.id]);
        assert.ok(get(engine.statistics).length > trackLength);
    });

    it('ignores what does not exist', async () => {
        await load('simple');
        const before = get(engine.selection);
        assert.equal(await engine.select(['00000000-0000-0000-0000-000000000000'], 'add'), false);
        assert.deepEqual(get(engine.selection), before);
    });
});

describe('statistics', () => {
    it('describes the selection', async () => {
        await load('simple');
        const statistics = get(engine.statistics);
        const file = fileStates()[0];
        assert.ok(statistics.length > 1);
        assert.equal(statistics.lng.length, statistics.length);
        assert.equal(statistics.ele.length, statistics.length);
        assert.equal(statistics.totalDistance[0], 0);
        assert.ok(statistics.global.totalDistance > 0);
        assert.equal(statistics.global.totalDistance, file.statistics.totalDistance);
        assert.equal(statistics.timestamps, undefined);
        assert.ok(statistics.global.bounds!.west <= statistics.global.bounds!.east);

        await engine.select([]);
        assert.equal(get(engine.statistics).length, 0);
        assert.equal(get(engine.statistics).global.totalDistance, 0);
    });

    it('has timestamps when the file has some', async () => {
        await load('with_time');
        const statistics = get(engine.statistics);
        assert.ok(statistics.timestamps);
        assert.equal(statistics.timestamps!.length, statistics.length);
        assert.ok(statistics.timestamps!.some((t) => t !== NO_TIME));
        assert.ok(statistics.global.totalTime! > 0);
        assert.ok(statistics.global.movingSpeed === undefined || statistics.global.movingSpeed > 0);
    });

    it('reads the metrics that are requested, and only these', async () => {
        await load('with_hr');
        assert.equal(get(engine.statistics).hr, undefined);

        const request = engine.requestStatistics();
        request.set(['hr', 'anchors']);
        const statistics = get(engine.statistics);
        assert.equal(statistics.hr!.length, statistics.length);
        assert.ok(statistics.hr!.some((hr) => !Number.isNaN(hr)));
        assert.equal(statistics.cad, undefined);
        assert.equal(statistics.anchors!.indices[0], 0);
        assert.equal(statistics.anchors!.indices.at(-1), statistics.length - 1);

        // they are read again after a change, without being asked again
        await engine.select([]);
        await engine.select([get(engine.order)[0]]);
        assert.ok(get(engine.statistics).hr);
        request.release();
        await engine.select([]);
        await engine.select([get(engine.order)[0]]);
        assert.equal(get(engine.statistics).hr, undefined);
    });

    it('gives the statistics of a part of the selection', async () => {
        await load('simple');
        const statistics = get(engine.statistics);
        const part = statistics.slice(2, 5)!;
        assert.ok(part.totalDistance > 0);
        assert.ok(part.totalDistance < statistics.global.totalDistance);
        assert.equal(statistics.slice(0, statistics.length + 10), undefined);

        // a slice is only valid for the selection it was made on
        await engine.select([]);
        assert.equal(statistics.slice(2, 5), undefined);
    });
});

describe('file state', () => {
    it('has one feature per segment and keeps the unchanged ones when editing', async () => {
        await load('with_tracks_and_segments');
        const before = fileStates()[0];
        assert.equal(
            before.segments.features.length,
            before.structure.tracks.reduce((sum, track) => sum + track.segments.length, 0)
        );

        // renaming does not touch the segments: they are the same objects
        await engine.metadata('renamed', 'description');
        const renamed = fileStates()[0];
        assert.equal(renamed.structure.name, 'renamed');
        assert.equal(renamed.structure.desc, 'description');
        renamed.segments.features.forEach((feature, i) => {
            assert.equal(feature, before.segments.features[i]);
        });

        // reversing a file reverses its tracks and their points
        await engine.reverse();
        const reversed = fileStates()[0].segments.features.map((f) => f.geometry.coordinates);
        const expected = [...renamed.segments.features]
            .reverse()
            .map((f) => [...f.geometry.coordinates].reverse());
        assert.deepEqual(reversed, expected);
        await engine.undo();
        fileStates()[0].segments.features.forEach((feature, i) => {
            assert.deepEqual(
                feature.geometry.coordinates,
                renamed.segments.features[i].geometry.coordinates
            );
        });
    });

    it('colors the files, and keeps the color of a file', async () => {
        await load('simple', 'with_tracks');
        const [a, b] = fileStates();
        assert.notEqual(a.color, b.color);

        await engine.select([a.structure.id]);
        await engine.style({ color: 'ff0000' });
        assert.equal(get(get(engine.files).get(a.structure.id)!).color, '#ff0000');
        const styled = get(get(engine.files).get(a.structure.id)!).segments.features[0];
        assert.equal(styled.properties.color, '#ff0000');

        await engine.undo();
        assert.equal(get(get(engine.files).get(a.structure.id)!).color, a.color);
    });

    it('has the waypoints as features', async () => {
        await load('with_waypoint');
        const file = fileStates()[0];
        assert.ok(file.waypoints.features.length > 0);
        const feature = file.waypoints.features[0];
        const details = engine.waypoint(file.structure.id, feature.properties.waypointId)!;
        assert.deepEqual(feature.geometry.coordinates, [details.lng, details.lat]);
        assert.equal(feature.properties.name, details.name);
        assert.equal(details.links?.[0].href, 'https://gpx.studio');
        assert.equal(details.links?.[0].text, 'waypoint link text');
    });
});

describe('waypoints', () => {
    const waypoint = {
        lng: 4.4,
        lat: 50.8,
        ele: 100,
        name: 'summit',
        desc: 'a nice view',
        icon: 'Summit',
        link: 'https://example.com',
    };

    it('creates, edits, moves and deletes a waypoint', async () => {
        await engine.newFile('file');
        assert.equal(await engine.newWaypoint(waypoint), true);
        const file = fileStates()[0];
        const id = file.waypoints.features[0].properties.waypointId;
        const fileId = file.structure.id;

        let details = engine.waypoint(fileId, id)!;
        assert.equal(details.name, 'summit');
        assert.equal(details.sym, 'Summit');
        assert.equal(details.links![0].href, 'https://example.com');

        await engine.updateWaypoint(fileId, id, { ...waypoint, name: 'peak', link: '' });
        details = engine.waypoint(fileId, id)!;
        assert.equal(details.name, 'peak');
        assert.equal(details.links, undefined);

        await engine.moveWaypoint(fileId, id, 5, 51, 200);
        assert.deepEqual(fileStates()[0].waypoints.features[0].geometry.coordinates, [5, 51]);
        assert.equal(engine.waypoint(fileId, id)!.ele, 200);

        await engine.deleteWaypoint(fileId, id);
        assert.equal(fileStates()[0].waypoints.features.length, 0);
        assert.equal(engine.waypoint(fileId, id), undefined);
        assert.equal(await engine.deleteWaypoint(fileId, id), false);
    });
});

describe('clipboard', () => {
    it('copies and pastes', async () => {
        await load('simple');
        assert.equal(get(engine.clipboard), undefined);
        assert.equal(get(engine.canPaste), false);
        await engine.copy();
        assert.equal(get(engine.clipboard)?.type, 'files');
        assert.equal(get(engine.canPaste), true);
        await engine.paste();
        assert.equal(get(engine.files).size, 2);
    });
});

describe('observer of the files', () => {
    it('tells which files appear and disappear', async () => {
        const added: string[] = [];
        const removed: string[] = [];
        let destroyed = 0;
        await load('simple');
        const [first] = get(engine.order);
        const observer = new FileStateCollectionObserver(
            (files) => files.forEach((_, id) => added.push(id)),
            (id) => removed.push(id),
            () => destroyed++
        );
        // the files that exist are reported at once
        assert.deepEqual(added, [first]);

        await load('with_tracks');
        const second = get(engine.order).find((id) => id !== first)!;
        assert.deepEqual(added, [first, second]);

        // editing a file does not make it appear again
        await engine.metadata('x', '');
        assert.equal(added.length, 2);

        await engine.deleteAll();
        assert.deepEqual(new Set(removed), new Set([first, second]));
        observer.destroy();
        assert.equal(destroyed, 1);
    });
});

describe('export', () => {
    const text = (id: string, options: Partial<ExportOptions> = {}) =>
        new TextDecoder().decode(engine.exportFile(id, { ...ALL_EXPORT_OPTIONS, ...options }));

    it('writes tracks, or routes when asked to', async () => {
        await load('with_tracks_and_segments');
        const file = fileStates()[0];
        const segments = file.structure.tracks.reduce(
            (sum, track) => sum + track.segments.length,
            0
        );
        const id = file.structure.id;

        const tracks = text(id);
        assert.ok(tracks.includes('<trk>') && !tracks.includes('<rte>'));
        assert.equal(tracks.match(/<trkseg>/g)?.length, segments);

        const routes = text(id, { asRoute: true });
        assert.ok(routes.includes('<rte>') && !routes.includes('<trk>'));
        assert.equal(routes.match(/<rte>/g)?.length, segments);
        assert.ok(routes.includes('<rtept'));
    });

    it('does not count the way a file is written among its data', async () => {
        await load('simple');
        const data = engine.exportableData(get(engine.order));
        assert.equal(data.asRoute, false);
    });

    it('can read back the routes it writes', async () => {
        await load('with_tracks_and_segments');
        const id = get(engine.order)[0];
        const before = fileStates()[0].segments.features.length;
        const routes = engine.exportFile(id, { ...ALL_EXPORT_OPTIONS, asRoute: true })!;
        await engine.loadFiles([{ data: routes, name: 'routes' }]);
        const [, loaded] = get(engine.order);
        const state = get(get(engine.files).get(loaded)!);
        // one route per segment, each read as a track of one segment
        assert.equal(state.structure.tracks.length, before);
        assert.equal(state.segments.features.length, before);
    });
});

describe('visibility', () => {
    it('hides the selection and shows it again', async () => {
        await load('simple');
        const id = get(engine.order)[0];
        const state = () => get(get(engine.files).get(id)!);
        assert.equal(isHidden(state(), id), false);

        await engine.setSelectionHidden(true);
        assert.equal(isHidden(state(), id), true);
        // the statistics still count what is hidden
        assert.ok(get(engine.statistics).length > 0);

        await engine.setSelectionHidden(false);
        assert.equal(isHidden(state(), id), false);
    });
});
