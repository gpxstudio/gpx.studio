import * as fs from 'fs';

import { parseGPX, buildGPX } from '../src/io';

describe("Parsing", () => {
    it("Simple", () => {
        const path = "test-data/simple.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        expect(result.attributes.creator).toBe("https://gpx.studio");
        expect(result.metadata.name).toBe("simple");
        expect(result.metadata.author.name).toBe("gpx.studio");
        expect(result.metadata.author.link.attributes.href).toBe("https://gpx.studio");

        expect(result.trk.length).toBe(1);

        const track = result.trk[0];
        expect(track.name).toBe("simple");
        expect(track.type).toBe("Cycling");
        expect(track.trkseg.length).toBe(1);

        const segment = track.trkseg[0];
        expect(segment.trkpt.length).toBe(80);

        for (let i = 0; i < segment.trkpt.length; i++) {
            const point = segment.trkpt[i];
            expect(point).toHaveProperty('attributes');
            expect(point.attributes).toHaveProperty('lat');
            expect(point.attributes).toHaveProperty('lon');
            expect(point).toHaveProperty('ele');
        }

        expect(segment.trkpt[0].attributes.lat).toBe(50.790867);
        expect(segment.trkpt[0].attributes.lon).toBe(4.404968);
        expect(segment.trkpt[0].ele).toBe(109.0);
    });

    it("Multiple tracks", () => {
        const path = "test-data/with_tracks.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        expect(result.trk.length).toBe(2);

        const track_1 = result.trk[0];
        expect(track_1.name).toBe("track 1");
        expect(track_1.trkseg.length).toBe(1);
        expect(track_1.trkseg[0].trkpt.length).toBe(49);

        const track_2 = result.trk[1];
        expect(track_2.name).toBe("track 2");
        expect(track_2.trkseg.length).toBe(1);
        expect(track_2.trkseg[0].trkpt.length).toBe(28);
    });

    it("Multiple segments", () => {
        const path = "test-data/with_segments.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        expect(result.trk.length).toBe(1);

        const track = result.trk[0];
        expect(track.trkseg.length).toBe(2);
        expect(track.trkseg[0].trkpt.length).toBe(49);
        expect(track.trkseg[1].trkpt.length).toBe(28);
    });

    it("Waypoint", () => {
        const path = "test-data/with_waypoint.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        expect(result.wpt.length).toBe(1);

        const waypoint = result.wpt[0];
        expect(waypoint.attributes.lat).toBe(50.7836710064975);
        expect(waypoint.attributes.lon).toBe(4.410764082658738);
        expect(waypoint.ele).toBe(122.0);
        expect(waypoint.name).toBe("Waypoint");
        expect(waypoint.cmt).toBe("Comment");
        expect(waypoint.desc).toBe("Description");
        expect(waypoint.sym).toBe("Bike Trail");
    });

    it("Time", () => {
        const path = "test-data/with_time.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i].time).toBeInstanceOf(Date);
        }

        expect(segment.trkpt[0].time).toEqual(new Date("2023-12-31T23:00:00.000Z"));
        expect(segment.trkpt[segment.trkpt.length - 1].time).toEqual(new Date("2023-12-31T23:06:40.567Z"));
    });

    it("Heart rate", () => {
        const path = "test-data/with_hr.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxtpx:TrackPointExtension');
            expect(segment.trkpt[i].extensions['gpxtpx:TrackPointExtension']).toHaveProperty('gpxtpx:hr');
        }

        expect(segment.trkpt[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr']).toBe(150);
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:hr']).toBe(160);
    });

    it("Cadence", () => {
        const path = "test-data/with_cad.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxtpx:TrackPointExtension');
            expect(segment.trkpt[i].extensions['gpxtpx:TrackPointExtension']).toHaveProperty('gpxtpx:cad');
        }

        expect(segment.trkpt[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad']).toBe(80);
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:cad']).toBe(90);
    });

    it("Temperature", () => {
        const path = "test-data/with_temp.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxtpx:TrackPointExtension');
            expect(segment.trkpt[i].extensions['gpxtpx:TrackPointExtension']).toHaveProperty('gpxtpx:atemp');
        }

        expect(segment.trkpt[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp']).toBe(21);
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:atemp']).toBe(22);
    });

    it("Power 1", () => {
        const path = "test-data/with_power_1.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxpx:PowerExtension');
            expect(segment.trkpt[i].extensions['gpxpx:PowerExtension']).toHaveProperty('gpxpx:PowerInWatts');
        }

        expect(segment.trkpt[0].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']).toBe(200);
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']).toBe(210);
    });

    it("Power 2", () => {
        const path = "test-data/with_power_2.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxpx:PowerExtension');
            expect(segment.trkpt[i].extensions['gpxpx:PowerExtension']).toHaveProperty('gpxpx:PowerInWatts');
        }

        expect(segment.trkpt[0].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']).toBe(200);
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxpx:PowerExtension']['gpxpx:PowerInWatts']).toBe(210);
    });

    it("Surface", () => {
        const path = "test-data/with_surface.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];
        const segment = track.trkseg[0];

        for (let i = 0; i < segment.trkpt.length; i++) {
            expect(segment.trkpt[i]).toHaveProperty('extensions');
            expect(segment.trkpt[i].extensions).toHaveProperty('gpxtpx:TrackPointExtension');
            expect(segment.trkpt[i].extensions['gpxtpx:TrackPointExtension']).toHaveProperty('gpxtpx:Extensions');
            expect(segment.trkpt[i].extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions']).toHaveProperty('surface');
        }

        expect(segment.trkpt[0].extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'].surface).toBe("asphalt");
        expect(segment.trkpt[segment.trkpt.length - 1].extensions['gpxtpx:TrackPointExtension']['gpxtpx:Extensions'].surface).toBe("cobblestone");
    });

    it("Track style", () => {
        const path = "test-data/with_style.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const result = parseGPX(data);

        const track = result.trk[0];

        expect(track).toHaveProperty('extensions');
        expect(track.extensions).toHaveProperty('gpx_style:line');

        expect(track.extensions['gpx_style:line']).toHaveProperty('color');
        expect(track.extensions['gpx_style:line']).toHaveProperty('opacity');
        expect(track.extensions['gpx_style:line']).toHaveProperty('weight');

        expect(track.extensions['gpx_style:line'].color).toBe("#2d3ee9");
        expect(track.extensions['gpx_style:line'].opacity).toBe(0.5);
        expect(track.extensions['gpx_style:line'].weight).toBe(6);
    });
});

describe("Building", () => {
    it("Simple", () => {
        const path = "test-data/simple.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Multiple tracks", () => {
        const path = "test-data/with_tracks.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Multiple segments", () => {
        const path = "test-data/with_segments.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Waypoint", () => {
        const path = "test-data/with_waypoint.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Time", () => {
        const path = "test-data/with_time.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Heart rate", () => {
        const path = "test-data/with_hr.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Cadence", () => {
        const path = "test-data/with_cad.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Temperature", () => {
        const path = "test-data/with_temp.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Power 1", () => {
        const path = "test-data/with_power_1.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Power 2", () => {
        const path = "test-data/with_power_2.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Surface", () => {
        const path = "test-data/with_surface.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });

    it("Track style", () => {
        const path = "test-data/with_style.gpx";
        const data = fs.readFileSync(path, 'utf8');
        const original = parseGPX(data);

        const built = buildGPX(original);
        const rebuilt = parseGPX(built);

        expect(rebuilt).toEqual(original);
    });
});