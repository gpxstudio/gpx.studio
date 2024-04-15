import * as fs from 'fs';

import { parseGPX } from '../src/io';

describe("Parsing tests", () => {
    it("Simple file", () => {
        const path = "test-data/simple.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        expect(result.creator).toBe("https://gpx.studio");
        expect(result.metadata.name).toBe("simple");
        expect(result.metadata.author.name).toBe("gpx.studio");
        expect(result.metadata.author.link.href).toBe("https://gpx.studio");

        expect(result.tracks.length).toBe(1);

        const track = result.tracks[0];
        expect(track.name).toBe("simple");
        expect(track.type).toBe("Cycling");
        expect(track.trkseg.length).toBe(1);

        const segment = track.trkseg[0];
        expect(segment.trkpt.length).toBe(80);

        for (let i = 0; i < segment.trkpt.length; i++) {
            const point = segment.trkpt[i];
            expect(point).toHaveProperty('lat');
            expect(point).toHaveProperty('lon');
            expect(point).toHaveProperty('ele');
        }
    });
});