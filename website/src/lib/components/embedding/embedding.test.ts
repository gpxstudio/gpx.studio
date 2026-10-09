import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    allowedEmbeddingBasemaps,
    convertOldEmbeddingOptions,
    defaultEmbeddingOptions,
    getCleanedEmbeddingOptions,
    getFilesFromEmbeddingOptions,
    getMergedEmbeddingOptions,
    getURLForGoogleDriveFile,
} from './embedding';

describe('embedding options', () => {
    it('are the defaults when nothing is given', () => {
        assert.deepEqual(getMergedEmbeddingOptions({}), defaultEmbeddingOptions);
        // and a copy of them
        const merged = getMergedEmbeddingOptions({});
        merged.elevation.show = false;
        assert.equal(defaultEmbeddingOptions.elevation.show, true);
    });

    it('override the defaults, also inside the groups of options', () => {
        const merged = getMergedEmbeddingOptions({
            basemap: 'osm',
            distanceUnits: 'imperial',
            elevation: { fill: 'slope', hr: true },
            files: ['https://example.com/a.gpx'],
        });
        assert.equal(merged.basemap, 'osm');
        assert.equal(merged.distanceUnits, 'imperial');
        assert.equal(merged.elevation.fill, 'slope');
        assert.equal(merged.elevation.hr, true);
        // the options of a group that are not given stay as they are
        assert.equal(merged.elevation.height, 170);
        assert.equal(merged.elevation.show, true);
        assert.deepEqual(merged.files, ['https://example.com/a.gpx']);
        assert.equal(merged.velocityUnits, 'speed');
    });

    it('take a list or a null as a value, not as a group', () => {
        const merged = getMergedEmbeddingOptions({ ids: ['a', 'b'], key: null });
        assert.deepEqual(merged.ids, ['a', 'b']);
        assert.equal(merged.key, null);
    });

    it('are cleaned of what is a default', () => {
        const options = getMergedEmbeddingOptions({ basemap: 'osm', elevation: { hr: true } });
        assert.deepEqual(getCleanedEmbeddingOptions(options), {
            basemap: 'osm',
            elevation: { hr: true },
        });
        assert.deepEqual(getCleanedEmbeddingOptions(defaultEmbeddingOptions), {});
        // merging what was cleaned gives the options back
        assert.deepEqual(getMergedEmbeddingOptions(getCleanedEmbeddingOptions(options)), options);
    });

    it('are cleaned of the key of the site, and keep the key of the user', () => {
        assert.deepEqual(
            getCleanedEmbeddingOptions({ ...defaultEmbeddingOptions, key: 'test-key' }),
            {}
        );
        assert.deepEqual(getCleanedEmbeddingOptions({ ...defaultEmbeddingOptions, key: 'mine' }), {
            key: 'mine',
        });
    });

    it('are not changed by cleaning them', () => {
        const options = getMergedEmbeddingOptions({ elevation: { hr: true } });
        const before = JSON.stringify(options);
        getCleanedEmbeddingOptions(options);
        assert.equal(JSON.stringify(options), before);
    });
});

describe('embedded files', () => {
    it('are the urls, then the files of Google Drive', () => {
        const options = getMergedEmbeddingOptions({
            files: ['https://example.com/a.gpx'],
            ids: ['abc', 'def'],
        });
        assert.deepEqual(getFilesFromEmbeddingOptions(options), [
            'https://example.com/a.gpx',
            getURLForGoogleDriveFile('abc'),
            getURLForGoogleDriveFile('def'),
        ]);
        assert.ok(getURLForGoogleDriveFile('abc').includes('/files/abc?alt=media'));
        assert.deepEqual(getFilesFromEmbeddingOptions(getMergedEmbeddingOptions({})), []);
    });

    it('can use the basemaps of the site except a few', () => {
        assert.ok(allowedEmbeddingBasemaps.includes('libertyTopo'));
        assert.ok(allowedEmbeddingBasemaps.includes('osm'));
        assert.ok(!allowedEmbeddingBasemaps.includes('ordnanceSurvey'));
        assert.ok(allowedEmbeddingBasemaps.includes(defaultEmbeddingOptions.basemap));
    });
});

describe('options of the old embedding', () => {
    const convert = (query: string) => convertOldEmbeddingOptions(new URLSearchParams(query));

    it('are converted to the new ones', () => {
        assert.deepEqual(convert(''), { key: 'test-key', files: [], ids: [] });
        assert.deepEqual(
            convert(
                'source=otm&imperial&running&distance&direction&slope&state=' +
                    encodeURIComponent(JSON.stringify({ ids: ['a'], urls: ['https://x/y.gpx'] }))
            ),
            {
                key: 'test-key',
                files: ['https://x/y.gpx'],
                ids: ['a'],
                basemap: 'openTopoMap',
                distanceUnits: 'imperial',
                velocityUnits: 'pace',
                distanceMarkers: true,
                directionMarkers: true,
                elevation: { fill: 'slope' },
            }
        );
    });

    it('convert the names of the sources', () => {
        assert.equal(convert('source=satellite').basemap, 'libertySatellite');
        assert.equal(convert('source=otm').basemap, 'openTopoMap');
        assert.equal(convert('source=ohm').basemap, 'openHikingMap');
        assert.equal(convert('source=unknown').basemap, undefined);
    });

    it('ignore a state that is not valid', () => {
        const empty = { key: 'test-key', files: [], ids: [] };
        assert.deepEqual(convert('state=%7Bbroken'), empty);
        assert.deepEqual(convert('state=null'), empty);
        assert.deepEqual(convert('state=42'), empty);
        assert.deepEqual(convert(`state=${encodeURIComponent('{"ids":"abc","urls":3}')}`), empty);
        assert.deepEqual(convert(`state=${encodeURIComponent('{"ids":["a"]}')}&imperial`), {
            ...empty,
            ids: ['a'],
            distanceUnits: 'imperial',
        });
    });

    it('can be merged with the defaults', () => {
        const merged = getMergedEmbeddingOptions(convert('slope&source=satellite'));
        assert.equal(merged.elevation.fill, 'slope');
        assert.equal(merged.elevation.height, 170);
        assert.equal(merged.basemap, 'libertySatellite');
    });
});
