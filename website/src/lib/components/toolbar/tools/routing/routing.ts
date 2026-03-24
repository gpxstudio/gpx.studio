import type { Coordinates } from 'gpx';
import { TrackPoint, distance } from 'gpx';
import { settings } from '$lib/logic/settings';
import { getElevation } from '$lib/utils';
import { get } from 'svelte/store';

const { routing, routingProfile, privateRoads } = settings;

export const brouterProfiles: { [key: string]: string } = {
    bike: 'Trekking-dry',
    racing_bike: 'fastbike',
    gravel_bike: 'gravel',
    mountain_bike: 'MTB',
    foot: 'Hiking-Alpine-SAC6',
    motorcycle: 'Car-FastEco',
    water: 'river',
    railway: 'rail',
};

export function route(points: Coordinates[]): Promise<TrackPoint[]> {
    if (get(routing)) {
        return getRoute(points, brouterProfiles[get(routingProfile)], get(privateRoads));
    } else {
        return getIntermediatePoints(points);
    }
}

async function getRoute(
    points: Coordinates[],
    brouterProfile: string,
    privateRoads: boolean
): Promise<TrackPoint[]> {
    let url = `/api/brouter?lonlats=${points.map((point) => `${point.lon.toFixed(8)},${point.lat.toFixed(8)}`).join('|')}&profile=${brouterProfile + (privateRoads ? '-private' : '')}&format=geojson&alternativeidx=0`;

    let response = await fetch(url);

    // Check if the response is ok
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
        let coord = coordinates[i];
        route.push(
            new TrackPoint({
                attributes: {
                    lat: coord[1],
                    lon: coord[0],
                },
                ele: coord[2] ?? (i > 0 ? route[i - 1].ele : 0),
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

    return densifyRoute(route);
}

// Insert intermediate points when consecutive points are too far apart,
// so that timestamp generation produces smooth, even intervals.
function densifyRoute(route: TrackPoint[], maxGap: number = 50): TrackPoint[] {
    if (route.length < 2) return route;

    let result: TrackPoint[] = [route[0]];
    for (let i = 1; i < route.length; i++) {
        const prev = route[i - 1];
        const curr = route[i];
        const dist = distance(prev.getCoordinates(), curr.getCoordinates());

        if (dist > maxGap) {
            const steps = Math.ceil(dist / maxGap);
            for (let s = 1; s < steps; s++) {
                const ratio = s / steps;
                const lat = prev.getLatitude() + ratio * (curr.getLatitude() - prev.getLatitude());
                const lon =
                    prev.getLongitude() + ratio * (curr.getLongitude() - prev.getLongitude());
                const ele =
                    prev.ele !== undefined && curr.ele !== undefined
                        ? prev.ele + ratio * (curr.ele - prev.ele)
                        : curr.ele ?? prev.ele;
                const pt = new TrackPoint({
                    attributes: { lat, lon },
                    ele,
                });
                // Carry over extensions from the previous point
                if (prev.extensions) {
                    pt.setExtensions(prev.extensions);
                }
                // Mark interpolated points so they don't become routing anchors
                pt._data.interpolated = true;
                result.push(pt);
            }
        }
        result.push(curr);
    }
    return result;
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
