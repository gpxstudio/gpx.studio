import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legacyFileToGPX, LEGACY_IMPORTED_KEY } from './legacy-import';

// A file as the former `gpx` library kept it.
const point = (lat: number, lon: number, extra: Record<string, unknown> = {}) => ({
    attributes: { lat, lon },
    ...extra,
});

describe('legacyFileToGPX', () => {
    it('writes a GPX file with its metadata, waypoints and tracks', () => {
        const gpx = legacyFileToGPX({
            metadata: {
                name: 'Morning ride',
                desc: 'Around the lake',
                author: {
                    name: 'someone',
                    link: { attributes: { href: 'https://gpx.studio' }, text: 'site' },
                },
                link: { attributes: { href: 'https://example.com' } },
                time: '2024-05-01T08:00:00.000Z',
            },
            wpt: [
                point(50.1, 4.2, {
                    ele: 100,
                    name: 'Café',
                    sym: 'Restaurant',
                    link: { attributes: { href: 'https://cafe.example' }, text: 'menu' },
                }),
            ],
            trk: [
                {
                    name: 'Track 1',
                    type: 'Cycling',
                    trkseg: [
                        {
                            trkpt: [
                                point(50, 4, { ele: 10, time: '2024-05-01T08:00:00.000Z' }),
                                point(50.001, 4.001, { ele: 12 }),
                            ],
                        },
                        { trkpt: [point(51, 5)] },
                    ],
                },
            ],
        });

        assert.ok(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.match(
            gpx,
            /<gpx version="1.1" creator="https:\/\/gpx.studio" xmlns="http:\/\/www.topografix.com\/GPX\/1\/1"/
        );
        assert.match(gpx, /<metadata><name>Morning ride<\/name><desc>Around the lake<\/desc>/);
        assert.match(
            gpx,
            /<author><name>someone<\/name><link href="https:\/\/gpx.studio"><text>site<\/text><\/link><\/author>/
        );
        assert.match(
            gpx,
            /<link href="https:\/\/example.com"><\/link><time>2024-05-01T08:00:00.000Z<\/time><\/metadata>/
        );
        assert.match(
            gpx,
            /<wpt lat="50.1" lon="4.2"><ele>100<\/ele><name>Café<\/name><link href="https:\/\/cafe.example"><text>menu<\/text><\/link><sym>Restaurant<\/sym><\/wpt>/
        );
        assert.match(gpx, /<trk><name>Track 1<\/name><type>Cycling<\/type><trkseg>/);
        assert.match(
            gpx,
            /<trkpt lat="50" lon="4"><ele>10<\/ele><time>2024-05-01T08:00:00.000Z<\/time><\/trkpt>/
        );
        assert.equal((gpx.match(/<trkseg>/g) ?? []).length, 2);
        assert.equal((gpx.match(/<trkpt /g) ?? []).length, 3);
    });

    it('writes an empty file for an empty object', () => {
        const gpx = legacyFileToGPX({});
        assert.ok(gpx.includes('<metadata></metadata></gpx>'));
        assert.ok(!gpx.includes('<trk>') && !gpx.includes('<wpt'));
    });

    it('escapes the text and the attributes', () => {
        const gpx = legacyFileToGPX({
            metadata: { name: 'Tom & Jerry <3', desc: 'a > b' },
            wpt: [
                point(1, 2, {
                    name: '"quoted" & <tagged>',
                    link: { attributes: { href: 'https://example.com/?a="1"&b=2' } },
                }),
            ],
        });
        assert.ok(gpx.includes('<name>Tom &amp; Jerry &lt;3</name>'));
        assert.ok(gpx.includes('<desc>a &gt; b</desc>'));
        assert.ok(gpx.includes('<name>"quoted" &amp; &lt;tagged&gt;</name>'));
        assert.ok(gpx.includes('href="https://example.com/?a=&quot;1&quot;&amp;b=2"'));
    });

    it('leaves out what is missing or empty', () => {
        const gpx = legacyFileToGPX({
            metadata: { name: '', desc: null, time: 'not a date' },
            wpt: [point(1, 2, { name: '', ele: undefined, link: { attributes: {} } })],
            trk: [{ trkseg: [{ trkpt: [point(1, 2, { time: 'garbage' })] }] }],
        });
        assert.ok(!gpx.includes('<name>') && !gpx.includes('<desc>'));
        assert.ok(!gpx.includes('<time>'));
        assert.ok(!gpx.includes('<link'));
        assert.ok(gpx.includes('<wpt lat="1" lon="2"></wpt>'));
        assert.ok(gpx.includes('<trkpt lat="1" lon="2"></trkpt>'));
        // a track with a segment that has no points is still a segment
        assert.ok(legacyFileToGPX({ trk: [{ trkseg: [{}] }] }).includes('<trkseg></trkseg>'));
    });

    it('writes the style of the tracks', () => {
        const gpx = legacyFileToGPX({
            trk: [
                {
                    extensions: {
                        'gpx_style:line': {
                            'gpx_style:color': 'ff0000',
                            'gpx_style:opacity': 0.5,
                            'gpx_style:width': 6,
                        },
                    },
                    trkseg: [],
                },
            ],
        });
        assert.ok(
            gpx.includes(
                '<extensions><gpx_style:line><gpx_style:color>ff0000</gpx_style:color><gpx_style:opacity>0.5</gpx_style:opacity><gpx_style:width>6</gpx_style:width></gpx_style:line></extensions>'
            )
        );
    });

    it('writes the extensions of the trackpoints', () => {
        const gpx = legacyFileToGPX({
            trk: [
                {
                    trkseg: [
                        {
                            trkpt: [
                                point(1, 2, {
                                    extensions: {
                                        'gpxtpx:TrackPointExtension': {
                                            'gpxtpx:atemp': 17.5,
                                            'gpxtpx:hr': 142,
                                            'gpxtpx:cad': 85,
                                            'gpxtpx:Extensions': {
                                                surface: 'asphalt',
                                                highway: 'cycleway',
                                            },
                                        },
                                        'gpxpx:PowerExtension': { 'gpxpx:PowerInWatts': 230 },
                                    },
                                }),
                                point(3, 4, {
                                    extensions: {
                                        'gpxtpx:TrackPointExtension': { 'gpxtpx:hr': 100 },
                                    },
                                }),
                                point(5, 6, {
                                    extensions: {
                                        'gpxpx:PowerExtension': { 'gpxpx:PowerInWatts': 0 },
                                    },
                                }),
                            ],
                        },
                    ],
                },
            ],
        });
        assert.ok(
            gpx.includes(
                '<extensions><gpxtpx:TrackPointExtension><gpxtpx:atemp>17.5</gpxtpx:atemp><gpxtpx:hr>142</gpxtpx:hr><gpxtpx:cad>85</gpxtpx:cad><gpxtpx:Extensions><surface>asphalt</surface><highway>cycleway</highway></gpxtpx:Extensions></gpxtpx:TrackPointExtension><gpxpx:PowerExtension><gpxpx:PowerInWatts>230</gpxpx:PowerInWatts></gpxpx:PowerExtension></extensions>'
            )
        );
        assert.ok(
            gpx.includes(
                '<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>100</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>'
            )
        );
        // a power of 0 W is a value
        assert.ok(gpx.includes('<gpxpx:PowerInWatts>0</gpxpx:PowerInWatts>'));
    });

    it('knows the setting that tells the import is done', () => {
        assert.equal(LEGACY_IMPORTED_KEY, 'legacyImported');
    });
});
