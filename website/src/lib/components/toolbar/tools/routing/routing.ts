import { distance, type Coordinates } from '$lib/geo';
import { settings } from '$lib/logic/settings';
import { getElevation } from '$lib/utils';
import { get } from 'svelte/store';

const { routing, routingProfile, privateRoads } = settings;

export type RoutingProfile = {
    engine: 'graphhopper' | 'brouter';
    profile: string;
};

export const routingProfiles: { [key: string]: RoutingProfile } = {
    bike: { engine: 'graphhopper', profile: 'bike' },
    racing_bike: { engine: 'graphhopper', profile: 'racingbike' },
    gravel_bike: { engine: 'graphhopper', profile: 'gravelbike' },
    mountain_bike: { engine: 'graphhopper', profile: 'mtb' },
    foot: { engine: 'graphhopper', profile: 'foot' },
    motorcycle: { engine: 'graphhopper', profile: 'motorbike' },
    water: { engine: 'brouter', profile: 'river' },
    railway: { engine: 'brouter', profile: 'rail' },
};

/**
 * The trackpoints of a route, as arrays with an entry per trackpoint. The OSM attributes are
 * `undefined` where the router does not know them.
 */
export type RoutedPoints = {
    lng: number[];
    lat: number[];
    ele: number[];
    surface: (string | undefined)[];
    highway: (string | undefined)[];
    sacScale: (string | undefined)[];
    mtbScale: (string | undefined)[];
};

export function emptyRoute(): RoutedPoints {
    return { lng: [], lat: [], ele: [], surface: [], highway: [], sacScale: [], mtbScale: [] };
}

/** Adds a trackpoint, which has the elevation of the previous one if it has none. */
export function addPoint(route: RoutedPoints, lng: number, lat: number, ele: number | undefined) {
    route.lng.push(lng);
    route.lat.push(lat);
    route.ele.push(ele ?? route.ele[route.ele.length - 1] ?? 0);
    route.surface.push(undefined);
    route.highway.push(undefined);
    route.sacScale.push(undefined);
    route.mtbScale.push(undefined);
}

export function route(points: Coordinates[]): Promise<RoutedPoints> {
    if (get(routing)) {
        const profile = routingProfiles[get(routingProfile)];
        if (profile.engine === 'graphhopper') {
            return getGraphHopperRoute(points, profile.profile, get(privateRoads));
        } else {
            return getBRouterRoute(points, profile.profile);
        }
    } else {
        return getIntermediatePoints(points);
    }
}

const graphhopperDetails = ['road_class', 'surface', 'hike_rating', 'mtb_rating'];
const hikeRatingToSACScale: { [key: string]: string } = {
    '1': 'hiking',
    '2': 'mountain_hiking',
    '3': 'demanding_mountain_hiking',
    '4': 'alpine_hiking',
    '5': 'demanding_alpine_hiking',
    '6': 'difficult_alpine_hiking',
};
const mtbRatingToScale: { [key: string]: string } = {
    '1': '0',
    '2': '1',
    '3': '2',
    '4': '3',
    '5': '4',
    '6': '5',
    '7': '6',
};

export const graphhopperBlockPrivateCustomModels: { [key: string]: any } = {
    bike: {
        priority: [
            {
                if: 'bike_road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
    racingbike: {
        priority: [
            {
                if: 'bike_road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
    gravelbike: {
        priority: [
            {
                if: 'bike_road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
    mtb: {
        priority: [
            {
                if: 'bike_road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
    foot: {
        priority: [
            {
                if: 'foot_road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
    motorbike: {
        priority: [
            {
                if: 'road_access == PRIVATE',
                multiply_by: '0.0',
            },
        ],
    },
};
async function getGraphHopperRoute(
    points: Coordinates[],
    graphHopperProfile: string,
    privateRoads: boolean
): Promise<RoutedPoints> {
    let response = await fetch('https://graphhopper.gpx.studio/route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            points: points.map((point) => [point.lng, point.lat]),
            profile: graphHopperProfile,
            elevation: true,
            points_encoded: false,
            details: graphhopperDetails,
            custom_model: privateRoads
                ? {}
                : graphhopperBlockPrivateCustomModels[graphHopperProfile] || {},
        }),
    });

    if (!response.ok) {
        throw graphHopperError(await response.json(), points.length);
    }

    return parseGraphHopperRoute(await response.json());
}

/** The error to throw for the error response of GraphHopper. Its message is a translation key. */
export function graphHopperError(
    error: { message?: string; hints?: { details?: string }[] },
    pointCount: number
): Error {
    const message = error.message ?? '';
    const details = error.hints?.[0]?.details ?? '';
    if (message.includes('Cannot find point 0')) {
        return new Error('toolbar.routing.error.from');
    } else if (message.includes('Cannot find point 1')) {
        return new Error(
            pointCount == 3 ? 'toolbar.routing.error.via' : 'toolbar.routing.error.to'
        );
    } else if (details.includes('PointDistanceExceededException')) {
        return new Error('toolbar.routing.error.distance');
    } else if (details.includes('ConnectionNotFoundException')) {
        return new Error('toolbar.routing.error.connection');
    }
    return new Error(message);
}

/**
 * The route of a response of GraphHopper. The details of the path (road class, surface...) are
 * given as ranges of points: `[from, to, value]`, `to` excluded except for the last range, which
 * includes the last point.
 */
export function parseGraphHopperRoute(json: any): RoutedPoints {
    const route = emptyRoute();
    const coordinates = json.paths[0].points.coordinates;
    const details = json.paths[0].details;

    for (let i = 0; i < coordinates.length; i++) {
        addPoint(route, coordinates[i][0], coordinates[i][1], coordinates[i][2]);
    }

    for (const key of graphhopperDetails) {
        const detail = details[key] ?? [];
        for (let i = 0; i < detail.length; i++) {
            for (let j = detail[i][0]; j < detail[i][1] + (i == detail.length - 1 ? 1 : 0); j++) {
                if (detail[i][2] !== undefined && detail[i][2] !== 'missing') {
                    if (key === 'road_class') {
                        route.highway[j] = detail[i][2];
                    } else if (key === 'hike_rating') {
                        route.sacScale[j] = hikeRatingToSACScale[detail[i][2]];
                    } else if (key === 'mtb_rating') {
                        route.mtbScale[j] = mtbRatingToScale[detail[i][2]];
                    } else if (key === 'surface' && detail[i][2] !== 'other') {
                        route.surface[j] = detail[i][2];
                    }
                }
            }
        }
    }

    return route;
}

async function getBRouterRoute(
    points: Coordinates[],
    brouterProfile: string
): Promise<RoutedPoints> {
    let url = `https://brouter.de/brouter?lonlats=${points.map((point) => `${point.lng.toFixed(8)},${point.lat.toFixed(8)}`).join('|')}&profile=${brouterProfile}&format=geojson&alternativeidx=0`;

    let response = await fetch(url);

    if (!response.ok) {
        throw brouterError(await response.text());
    }

    return parseBRouterRoute(await response.json());
}

/** The error to throw for the error response of BRouter. Its message is a translation key. */
export function brouterError(error: string): Error {
    if (error.includes('from-position not mapped in existing datafile')) {
        return new Error('toolbar.routing.error.from');
    } else if (error.includes('via1-position not mapped in existing datafile')) {
        return new Error('toolbar.routing.error.via');
    } else if (error.includes('to-position not mapped in existing datafile')) {
        return new Error('toolbar.routing.error.to');
    } else if (error.includes('Time-out')) {
        return new Error('toolbar.routing.error.timeout');
    }
    return new Error(error);
}

/**
 * The route of a response of BRouter (GeoJSON). The tags of the ways are in the `messages`, one
 * per way: a way starts at the point whose position the message gives, and applies up to the
 * next message.
 */
export function parseBRouterRoute(geojson: any): RoutedPoints {
    const route = emptyRoute();
    const coordinates = geojson.features[0].geometry.coordinates;
    const messages = geojson.features[0].properties.messages;

    const lngIdx = messages[0].indexOf('Longitude');
    const latIdx = messages[0].indexOf('Latitude');
    const tagIdx = messages[0].indexOf('WayTags');
    let messageIdx = 1;
    let tags = messageIdx < messages.length ? getTags(messages[messageIdx][tagIdx]) : {};

    for (let i = 0; i < coordinates.length; i++) {
        addPoint(route, coordinates[i][0], coordinates[i][1], coordinates[i][2]);

        if (
            messageIdx < messages.length &&
            coordinates[i][0] == Number(messages[messageIdx][lngIdx]) / 1000000 &&
            coordinates[i][1] == Number(messages[messageIdx][latIdx]) / 1000000
        ) {
            messageIdx++;

            if (messageIdx == messages.length) tags = {};
            else tags = getTags(messages[messageIdx][tagIdx]);
        }

        route.surface[i] = tags.surface;
        route.highway[i] = tags.highway;
        route.sacScale[i] = tags.sac_scale;
        route.mtbScale[i] = tags.mtb_scale;
    }

    return route;
}

/** The tags of a way, `key=value` separated by spaces, with the `:` of the keys as `_`. */
export function getTags(message: string): { [key: string]: string } {
    const fields = message.split(' ');
    let tags: { [key: string]: string } = {};
    for (let i = 0; i < fields.length; i++) {
        let [key, value] = fields[i].split('=');
        key = key.replace(/:/g, '_');
        tags[key] = value;
    }
    return tags;
}

/**
 * The points of a straight route through `points`: one every 50 m, and the last one. The
 * elevations are 0.
 */
export function interpolatePoints(points: Coordinates[]): RoutedPoints {
    const route = emptyRoute();
    const step = 0.05;

    for (let i = 0; i < points.length - 1; i++) {
        // Add intermediate points between each pair of points
        const dist = distance(points[i], points[i + 1]) / 1000;
        for (let d = 0; d < dist; d += step) {
            const lat = points[i].lat + (d / dist) * (points[i + 1].lat - points[i].lat);
            const lng = points[i].lng + (d / dist) * (points[i + 1].lng - points[i].lng);
            addPoint(route, lng, lat, 0);
        }
    }

    const last = points[points.length - 1];
    if (last) {
        addPoint(route, last.lng, last.lat, 0);
    }
    return route;
}

function getIntermediatePoints(points: Coordinates[]): Promise<RoutedPoints> {
    const route = interpolatePoints(points);
    return getElevation(route.lng.map((lng, i) => ({ lng, lat: route.lat[i] }))).then(
        (elevations) => {
            route.ele = elevations;
            return route;
        }
    );
}
