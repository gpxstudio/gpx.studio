import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { distance } from '$lib/geo';
import {
    brouterError,
    getTags,
    graphHopperError,
    graphhopperBlockPrivateCustomModels,
    interpolatePoints,
    parseBRouterRoute,
    parseGraphHopperRoute,
    routingProfiles,
} from './routing';

describe('routing profiles', () => {
    it('block the private roads of every profile of GraphHopper that has a model', () => {
        const profiles = Object.values(routingProfiles)
            .filter((profile) => profile.engine === 'graphhopper')
            .map((profile) => profile.profile);
        assert.ok(profiles.length > 0);
        for (const profile of profiles) {
            assert.ok(graphhopperBlockPrivateCustomModels[profile], profile);
        }
        // and the models are about profiles that exist
        for (const profile of Object.keys(graphhopperBlockPrivateCustomModels)) {
            assert.ok(profiles.includes(profile), profile);
        }
    });
});

describe('GraphHopper', () => {
    const response = (details: Record<string, unknown[]>, coordinates: number[][]) => ({
        paths: [{ points: { coordinates }, details }],
    });
    const coordinates = [
        [4.0, 50.0, 100],
        [4.1, 50.1, 110],
        [4.2, 50.2, 120],
        [4.3, 50.3, 130],
        [4.4, 50.4],
    ];

    it('gives the points of the route, with the elevation of the previous one when missing', () => {
        const route = parseGraphHopperRoute(response({}, coordinates));
        assert.deepEqual(route.lng, [4.0, 4.1, 4.2, 4.3, 4.4]);
        assert.deepEqual(route.lat, [50.0, 50.1, 50.2, 50.3, 50.4]);
        assert.deepEqual(route.ele, [100, 110, 120, 130, 130]);
        assert.deepEqual(route.surface, new Array(5).fill(undefined));
    });

    it('gives the details to the points of their ranges, the last range including the last point', () => {
        const route = parseGraphHopperRoute(
            response(
                {
                    road_class: [
                        [0, 2, 'cycleway'],
                        [2, 4, 'path'],
                    ],
                    surface: [
                        [0, 3, 'asphalt'],
                        [3, 4, 'gravel'],
                    ],
                    hike_rating: [[0, 4, '2']],
                    mtb_rating: [
                        [0, 1, '1'],
                        [1, 4, '5'],
                    ],
                },
                coordinates
            )
        );
        assert.deepEqual(route.highway, ['cycleway', 'cycleway', 'path', 'path', 'path']);
        assert.deepEqual(route.surface, ['asphalt', 'asphalt', 'asphalt', 'gravel', 'gravel']);
        // the ratings are converted to the scales
        assert.deepEqual(route.sacScale, new Array(5).fill('mountain_hiking'));
        assert.deepEqual(route.mtbScale, ['0', '4', '4', '4', '4']);
    });

    it('ignores the details that are missing or unknown', () => {
        const route = parseGraphHopperRoute(
            response(
                {
                    road_class: [
                        [0, 2, 'missing'],
                        [2, 4, 'primary'],
                    ],
                    surface: [[0, 4, 'other']],
                    hike_rating: [[0, 4, '9']],
                },
                coordinates
            )
        );
        assert.deepEqual(route.highway, [undefined, undefined, 'primary', 'primary', 'primary']);
        assert.deepEqual(route.surface, new Array(5).fill(undefined));
        assert.deepEqual(route.sacScale, new Array(5).fill(undefined));
    });

    it('turns its errors into the messages of the interface', () => {
        const error = (message: string, details = '', count = 2) =>
            graphHopperError({ message, hints: [{ details }] }, count).message;
        assert.equal(error('Cannot find point 0: 1,2'), 'toolbar.routing.error.from');
        assert.equal(error('Cannot find point 1: 1,2', '', 2), 'toolbar.routing.error.to');
        assert.equal(error('Cannot find point 1: 1,2', '', 3), 'toolbar.routing.error.via');
        assert.equal(
            error('x', 'com.graphhopper.PointDistanceExceededException'),
            'toolbar.routing.error.distance'
        );
        assert.equal(
            error('x', 'ConnectionNotFoundException: no way'),
            'toolbar.routing.error.connection'
        );
        assert.equal(error('something else'), 'something else');
        // an error without hints is still an error
        assert.equal(graphHopperError({ message: 'no hints' }, 2).message, 'no hints');
        assert.equal(graphHopperError({}, 2).message, '');
    });
});

describe('BRouter', () => {
    const messages = [
        [
            'Longitude',
            'Latitude',
            'Elevation',
            'Distance',
            'CostPerKm',
            'ElevCost',
            'TurnCost',
            'NodeCost',
            'InitialCost',
            'WayTags',
            'NodeTags',
        ],
        [
            '4100000',
            '50100000',
            '100',
            '10',
            '0',
            '0',
            '0',
            '0',
            '0',
            'highway=path surface=gravel sac_scale=hiking',
            '',
        ],
        [
            '4300000',
            '50300000',
            '120',
            '10',
            '0',
            '0',
            '0',
            '0',
            '0',
            'highway=residential surface=asphalt mtb:scale=1',
            '',
        ],
    ];
    const geojson = (coordinates: number[][], messages_: string[][] = messages) => ({
        features: [{ geometry: { coordinates }, properties: { messages: messages_ } }],
    });

    it('reads the tags of a way', () => {
        assert.deepEqual(getTags('highway=path surface=gravel'), {
            highway: 'path',
            surface: 'gravel',
        });
        assert.deepEqual(getTags('sac_scale=hiking mtb:scale=2'), {
            sac_scale: 'hiking',
            mtb_scale: '2',
        });
        assert.deepEqual(getTags('a:b:c=d'), { a_b_c: 'd' });
        assert.deepEqual(getTags(''), { '': undefined });
    });

    it('gives each point the tags of its way', () => {
        const route = parseBRouterRoute(
            geojson([
                [4.0, 50.0, 90],
                [4.1, 50.1, 100],
                [4.2, 50.2, 110],
                [4.3, 50.3, 120],
                [4.4, 50.4, 130],
            ])
        );
        assert.deepEqual(route.ele, [90, 100, 110, 120, 130]);
        // the first way is the one of the first message, whose last point is the start of the next
        assert.deepEqual(route.highway, [
            'path',
            'residential',
            'residential',
            undefined,
            undefined,
        ]);
        assert.deepEqual(route.surface, ['gravel', 'asphalt', 'asphalt', undefined, undefined]);
        assert.deepEqual(route.sacScale, ['hiking', undefined, undefined, undefined, undefined]);
        assert.deepEqual(route.mtbScale, [undefined, '1', '1', undefined, undefined]);
    });

    it('has no tags for a route without messages', () => {
        const route = parseBRouterRoute(
            geojson(
                [
                    [4, 50, 1],
                    [4.1, 50.1, 2],
                ],
                [messages[0]]
            )
        );
        assert.deepEqual(route.lng, [4, 4.1]);
        assert.deepEqual(route.highway, [undefined, undefined]);
    });

    it('turns its errors into the messages of the interface', () => {
        assert.equal(
            brouterError('from-position not mapped in existing datafile').message,
            'toolbar.routing.error.from'
        );
        assert.equal(
            brouterError('via1-position not mapped in existing datafile').message,
            'toolbar.routing.error.via'
        );
        assert.equal(
            brouterError('to-position not mapped in existing datafile').message,
            'toolbar.routing.error.to'
        );
        assert.equal(
            brouterError('operation killed by Time-out').message,
            'toolbar.routing.error.timeout'
        );
        assert.equal(brouterError('other').message, 'other');
    });
});

describe('straight routes', () => {
    it('have a point every 50 m and the last point', () => {
        const a = { lng: 4, lat: 50 };
        const b = { lng: 4.001, lat: 50 };
        const route = interpolatePoints([a, b]);
        const length = distance(a, b);
        assert.equal(route.lng.length, Math.ceil(length / 50) + 1);
        assert.deepEqual([route.lng[0], route.lat[0]], [4, 50]);
        assert.deepEqual([route.lng.at(-1), route.lat.at(-1)], [4.001, 50]);
        // the points are in order, and evenly spaced
        for (let i = 1; i < route.lng.length - 1; i++) {
            const step = distance(
                { lng: route.lng[i - 1], lat: route.lat[i - 1] },
                { lng: route.lng[i], lat: route.lat[i] }
            );
            assert.ok(Math.abs(step - 50) < 1, `${step}`);
        }
        assert.ok(route.ele.every((ele) => ele === 0));
        assert.equal(route.surface.length, route.lng.length);
    });

    it('go through the intermediate points', () => {
        const route = interpolatePoints([
            { lng: 4, lat: 50 },
            { lng: 4.001, lat: 50 },
            { lng: 4.001, lat: 50.001 },
        ]);
        assert.ok(route.lng.includes(4.001) && route.lat.includes(50.001));
        const corner = route.lng.findIndex((lng, i) => lng === 4.001 && route.lat[i] === 50);
        assert.ok(corner > 0);
    });

    it('are a point for one point, nothing for none', () => {
        const route = interpolatePoints([{ lng: 4, lat: 50 }]);
        assert.deepEqual(route.lng, [4]);
        assert.deepEqual(interpolatePoints([]).lng, []);
        // two points at the same place
        assert.deepEqual(
            interpolatePoints([
                { lng: 4, lat: 50 },
                { lng: 4, lat: 50 },
            ]).lng,
            [4]
        );
    });
});
