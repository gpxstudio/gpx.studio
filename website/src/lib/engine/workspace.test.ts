import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileIdAt, folderName, subfolder } from '$lib/engine/workspace';

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
