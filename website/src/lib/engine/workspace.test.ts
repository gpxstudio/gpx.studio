import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    editableName,
    fileIdAt,
    folderName,
    isWithin,
    parentOf,
    relocated,
    subfolder,
} from '$lib/engine/workspace';

describe('subfolder', () => {
    it('is where a file is in the folder', () => {
        assert.equal(subfolder('/home/me/tracks', '/home/me/tracks/a.gpx'), '');
        assert.equal(subfolder('/home/me/tracks', '/home/me/tracks/2024/may/a.gpx'), '2024/may');
        assert.equal(
            subfolder('C:\\Users\\me\\tracks', 'C:\\Users\\me\\tracks\\2024\\a.gpx'),
            '2024'
        );
    });

    it('is nothing for a file that is not in the folder', () => {
        assert.equal(subfolder('/home/me/tracks', '/home/me/other/a.gpx'), undefined);
        assert.equal(subfolder('/home/me/tracks', '/home/me/tracks-old/a.gpx'), undefined);
        assert.equal(subfolder('/home/me/tracks', undefined), undefined);
        assert.equal(subfolder(undefined, '/home/me/tracks/a.gpx'), undefined);
    });
});

describe('folderName', () => {
    it('is the last part of the path', () => {
        assert.equal(folderName('/home/me/tracks'), 'tracks');
        assert.equal(folderName('/home/me/tracks/'), 'tracks');
        assert.equal(folderName('C:\\Users\\me\\tracks'), 'tracks');
    });
});

describe('fileIdAt', () => {
    const workspace = {
        files: {
            a: { path: '/tracks/a.gpx' },
            b: { path: '/tracks/sub/b.gpx' },
            c: {},
        },
    };

    it('is the open file that is linked to the path', () => {
        assert.equal(fileIdAt(workspace, '/tracks/a.gpx'), 'a');
        assert.equal(fileIdAt(workspace, '/tracks/sub/b.gpx'), 'b');
    });

    it('is nothing for a file that is not open', () => {
        assert.equal(fileIdAt(workspace, '/tracks/other.gpx'), undefined);
        assert.equal(fileIdAt(undefined, '/tracks/a.gpx'), undefined);
    });
});

describe('parentOf', () => {
    it('is the folder that holds the path', () => {
        assert.equal(parentOf('/home/me/tracks/a.gpx'), '/home/me/tracks');
        assert.equal(parentOf('C:\\Users\\me\\a.gpx'), 'C:\\Users\\me');
    });
});

describe('relocated', () => {
    it('is where a path is once moved or renamed', () => {
        assert.equal(relocated('/me/tracks/a.gpx', '/me/trips'), '/me/trips/a.gpx');
        assert.equal(relocated('/me/tracks', '/me', 'rides'), '/me/rides');
        assert.equal(relocated('C:\\me\\tracks', 'C:\\me', 'rides'), 'C:\\me\\rides');
    });
});

describe('isWithin', () => {
    it('is the folder itself or what is in it', () => {
        assert.ok(isWithin('/home/me/tracks', '/home/me/tracks'));
        assert.ok(isWithin('/home/me/tracks/2024/a.gpx', '/home/me/tracks'));
        assert.ok(isWithin('C:\\me\\tracks\\a.gpx', 'C:\\me\\tracks'));
    });

    it('is not a folder whose name begins the same', () => {
        assert.ok(!isWithin('/home/me/tracks-old/a.gpx', '/home/me/tracks'));
        assert.ok(!isWithin('/home/me', '/home/me/tracks'));
    });
});

describe('editableName', () => {
    it('leaves out the extension of a file, not of a folder', () => {
        assert.equal(editableName('ride.gpx', false), 'ride');
        assert.equal(editableName('my.trips', true), 'my.trips');
        assert.equal(editableName('.hidden', false), '.hidden');
    });
});
