import assert from 'node:assert/strict';
import { test } from 'node:test';
import { XMLParser } from 'fast-xml-parser';
import { buildGPX, parseGPX } from '../src/io';

// Run from website: npx tsx --test ../gpx/tests/power.test.ts
function trackWithExtensions(extensions: string[]) {
    return parseGPX(`
        <gpx version="1.1" creator="power-test"
             xmlns="http://www.topografix.com/GPX/1/1"
             xmlns:gpxpx="http://www.garmin.com/xmlschemas/PowerExtension/v1"
             xmlns:watts="http://www.garmin.com/xmlschemas/PowerExtension/v1"
             xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
            <trk><trkseg>${extensions
                .map(
                    (extension, index) => `
                        <trkpt lat="46.000${index}" lon="7.000${index}">
                            <ele>422</ele>
                            <extensions>
                                <gpxtpx:TrackPointExtension>
                                    <gpxtpx:hr>87</gpxtpx:hr>
                                    <gpxtpx:cad>51</gpxtpx:cad>
                                </gpxtpx:TrackPointExtension>
                                ${extension}
                            </extensions>
                        </trkpt>`
                )
                .join('')}</trkseg></trk>
        </gpx>`);
}

const formats = {
    Garmin: (power: number) => `<gpxpx:PowerInWatts>${power}</gpxpx:PowerInWatts>`,
    'alternate namespace prefix': (power: number) =>
        `<watts:PowerInWatts>${power}</watts:PowerInWatts>`,
    Strava: (power: number) => `<power>${power}</power>`,
    'legacy wrapper': (power: number) =>
        `<gpxpx:PowerExtension><gpxpx:PowerInWatts>${power}</gpxpx:PowerInWatts></gpxpx:PowerExtension>`,
};

for (const [name, powerElement] of Object.entries(formats)) {
    test(`${name}: retain power, including zero, in statistics and GPX round trips`, () => {
        const file = trackWithExtensions([107, 0, 211].map(powerElement).concat(''));
        const expected = [107, 0, 211, undefined];

        assert.deepEqual(
            file.getTrackPoints().map((point) => point.getPower()),
            expected
        );
        assert.deepEqual(file.getStatistics().global.power, { avg: 106, count: 3 });

        const exported = buildGPX(file, []);
        const xml = new XMLParser({ ignoreAttributes: false }).parse(exported);
        const points = xml.gpx.trk.trkseg.trkpt;
        assert.deepEqual(
            points.map((point) => point.extensions['gpxpx:PowerInWatts']),
            expected
        );
        assert.doesNotMatch(exported, /PowerExtension>/);
        assert.deepEqual(
            parseGPX(exported)
                .getTrackPoints()
                .map((point) => point.getPower()),
            expected
        );
        assert.equal(points[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr'], 87);
        assert.equal(points[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad'], 51);
    });

    test(`${name}: excluding power does not remove other sensors or alter the source`, () => {
        const file = trackWithExtensions([powerElement(107), powerElement(0)]);
        const exported = buildGPX(file, ['power']);
        assert.doesNotMatch(exported, /PowerInWatts|PowerExtension>/);
        const points = parseGPX(exported).getTrackPoints();
        assert.deepEqual(
            points.map((point) => [point.getPower(), point.getHeartRate(), point.getCadence()]),
            [
                [undefined, 87, 51],
                [undefined, 87, 51],
            ]
        );
        assert.deepEqual(
            file.getTrackPoints().map((point) => point.getPower()),
            [107, 0]
        );
    });
}

test('a direct zero-watt value takes precedence over a legacy wrapped value', () => {
    const file = trackWithExtensions([formats.Garmin(0) + formats['legacy wrapper'](107)]);
    assert.equal(file.getTrackPoints()[0].getPower(), 0);
    assert.deepEqual(file.getStatistics().global.power, { avg: 0, count: 1 });
});
