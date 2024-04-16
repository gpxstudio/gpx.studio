import * as fs from 'fs';

import { parseGPX, buildGPX } from '../src/io';

describe('GPX operations', () => {
    it('Clone', () => {
        const path = "test-data/with_tracks_and_segments.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const cloned = original.clone();

        expect(cloned).not.toBe(original);

        const originalString = buildGPX(original);
        const clonedString = buildGPX(cloned);

        expect(clonedString).toBe(originalString);
    });

    it('Reverse', () => {
        const path = "test-data/with_tracks_and_segments.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        let reversed = original.clone();
        reversed.reverse();

        expect(reversed.trk.length).toBe(original.trk.length);

        for (let i = 0; i < original.trk.length; i++) {
            const originalTrack = original.trk[i];
            const reversedTrack = reversed.trk[original.trk.length - i - 1];

            expect(reversedTrack.trkseg.length).toBe(originalTrack.trkseg.length);

            for (let j = 0; j < originalTrack.trkseg.length; j++) {
                const originalSegment = originalTrack.trkseg[j];
                const reversedSegment = reversedTrack.trkseg[originalTrack.trkseg.length - j - 1];

                expect(reversedSegment.trkpt.length).toBe(originalSegment.trkpt.length);

                for (let k = 0; k < originalSegment.trkpt.length; k++) {
                    const originalPoint = originalSegment.trkpt[k];
                    const reversedPoint = reversedSegment.trkpt[originalSegment.trkpt.length - k - 1];

                    expect(reversedPoint.attributes.lat).toBe(originalPoint.attributes.lat);
                    expect(reversedPoint.attributes.lon).toBe(originalPoint.attributes.lon);
                    expect(reversedPoint.ele).toBe(originalPoint.ele);
                }
            }
        }
    });
});