import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { folderName, subfolder } from '$lib/engine/workspace';

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
