import type { Coordinates } from 'gpx';
import { TrackPoint, distance } from 'gpx';
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
    gravel_bike: { engine: 'brouter', profile: 'gravel' },
    mountain_bike: { engine: 'graphhopper', profile: 'mtb' },
    foot: { engine: 'graphhopper', profile: 'foot' },
    motorcycle: { engine: 'graphhopper', profile: 'motorcycle' },
    water: { engine: 'brouter', profile: 'river' },
    railway: { engine: 'brouter', profile: 'rail' },
};

export function route(points: Coordinates[]): Promise<TrackPoint[]> {
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
async function getGraphHopperRoute(
    points: Coordinates[],
    graphHopperProfile: string,
    privateRoads: boolean
): Promise<TrackPoint[]> {
    let response = await fetch('https://graphhopper-a.gpx.studio/route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            points: points.map((point) => [point.lon, point.lat]),
            profile: graphHopperProfile,
            elevation: true,
            points_encoded: false,
            details: graphhopperDetails,
            custom_model: privateRoads
                ? {}
                : {
                      priority: [
                          {
                              if: 'road_access == PRIVATE',
                              multiply_by: '0.0',
                          },
                      ],
                  },
        }),
    });

    if (!response.ok) {
        throw new Error(`${await response.text()}`);
    }

    let json = await response.json();

    let route: TrackPoint[] = [];
    let coordinates = json.paths[0].points.coordinates;
    let details = json.paths[0].details;

    for (let i = 0; i < coordinates.length; i++) {
        route.push(
            new TrackPoint({
                attributes: {
                    lat: coordinates[i][1],
                    lon: coordinates[i][0],
                },
                ele: coordinates[i][2] ?? (i > 0 ? route[i - 1].ele : 0),
                extensions: {},
            })
        );
    }

    for (let key of graphhopperDetails) {
        let detail = details[key];
        for (let i = 0; i < detail.length; i++) {
            for (let j = detail[i][0]; j < detail[i][1] + (i == detail.length - 1); j++) {
                if (detail[i][2] !== undefined && detail[i][2] !== 'missing') {
                    if (key === 'road_class') {
                        route[j].setExtension('highway', detail[i][2]);
                    } else if (key === 'hike_rating') {
                        const sacScale = hikeRatingToSACScale[detail[i][2]];
                        if (sacScale) {
                            route[j].setExtension('sac_scale', sacScale);
                        }
                    } else if (key === 'mtb_rating') {
                        const mtbScale = mtbRatingToScale[detail[i][2]];
                        if (mtbScale) {
                            route[j].setExtension('mtb_scale', mtbScale);
                        }
                    } else if (key === 'surface' && detail[i][2] !== 'other') {
                        route[j].setExtension('surface', detail[i][2]);
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
): Promise<TrackPoint[]> {
    let url = `https://brouter.de/brouter?lonlats=${points.map((point) => `${point.lon.toFixed(8)},${point.lat.toFixed(8)}`).join('|')}&profile=${brouterProfile}&format=geojson&alternativeidx=0`;

    let response = await fetch(url);

    if (!response.ok) {
        throw new Error(`${await response.text()}`);
    }

    let geojson = await response.json();

    let route: TrackPoint[] = [];
    let coordinates = geojson.features[0].geometry.coordinates;
    let messages = geojson.features[0].properties.messages;

    const lngIdx = messages[0].indexOf('Longitude');
    const latIdx = messages[0].indexOf('Latitude');
    const tagIdx = messages[0].indexOf('WayTags');
    let messageIdx = 1;
    let tags = messageIdx < messages.length ? getTags(messages[messageIdx][tagIdx]) : {};

    for (let i = 0; i < coordinates.length; i++) {
        route.push(
            new TrackPoint({
                attributes: {
                    lat: coordinates[i][1],
                    lon: coordinates[i][0],
                },
                ele: coordinates[i][2] ?? (i > 0 ? route[i - 1].ele : 0),
            })
        );

        if (
            messageIdx < messages.length &&
            coordinates[i][0] == Number(messages[messageIdx][lngIdx]) / 1000000 &&
            coordinates[i][1] == Number(messages[messageIdx][latIdx]) / 1000000
        ) {
            messageIdx++;

            if (messageIdx == messages.length) tags = {};
            else tags = getTags(messages[messageIdx][tagIdx]);
        }

        route[route.length - 1].setExtensions(tags);
    }

    return route;
}

function getTags(message: string): { [key: string]: string } {
    const fields = message.split(' ');
    let tags: { [key: string]: string } = {};
    for (let i = 0; i < fields.length; i++) {
        let [key, value] = fields[i].split('=');
        key = key.replace(/:/g, '_');
        tags[key] = value;
    }
    return tags;
}

function getIntermediatePoints(points: Coordinates[]): Promise<TrackPoint[]> {
    let route: TrackPoint[] = [];
    let step = 0.05;

    for (let i = 0; i < points.length - 1; i++) {
        // Add intermediate points between each pair of points
        let dist = distance(points[i], points[i + 1]) / 1000;
        for (let d = 0; d < dist; d += step) {
            let lat = points[i].lat + (d / dist) * (points[i + 1].lat - points[i].lat);
            let lon = points[i].lon + (d / dist) * (points[i + 1].lon - points[i].lon);
            route.push(
                new TrackPoint({
                    attributes: {
                        lat: lat,
                        lon: lon,
                    },
                })
            );
        }
    }

    route.push(
        new TrackPoint({
            attributes: {
                lat: points[points.length - 1].lat,
                lon: points[points.length - 1].lon,
            },
        })
    );

    return getElevation(route).then((elevations) => {
        route.forEach((point, i) => {
            point.ele = elevations[i];
        });
        return route;
    });
}
