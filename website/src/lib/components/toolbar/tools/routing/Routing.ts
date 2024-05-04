import type { Coordinates } from "gpx";
import { TrackPoint } from "gpx";
import { get, writable } from "svelte/store";
import { settings } from "$lib/db";
import { _ } from "svelte-i18n";

const { routing, routingProfile, privateRoads } = settings;

export const brouterProfiles: { [key: string]: string } = {
    bike: 'Trekking-dry',
    racing_bike: 'fastbike',
    mountain_bike: 'MTB',
    foot: 'Hiking-Alpine-SAC6',
    motorcycle: 'Car-FastEco',
    water: 'river',
    railway: 'rail'
};
export const routingProfileSelectItem = writable({
    value: 'bike',
    label: get(_)('toolbar.routing.activities.bike')
});
routingProfile.subscribe((value) => {
    if (value !== get(routingProfileSelectItem).value) {
        routingProfileSelectItem.update((item) => {
            item.value = value;
            item.label = get(_)(`toolbar.routing.activities.${value}`);
            return item;
        });
    }
});
routingProfileSelectItem.subscribe((item) => {
    if (item.value !== get(routingProfile)) {
        routingProfile.set(item.value);
    }
});

export function route(points: Coordinates[]): Promise<TrackPoint[]> {
    if (get(routing)) {
        return getRoute(points, brouterProfiles[get(routingProfile)], get(privateRoads));
    } else {
        return new Promise((resolve) => {
            resolve(points.map(point => new TrackPoint({
                attributes: {
                    lat: point.lat,
                    lon: point.lon
                }
            })));
        });
    }
}

async function getRoute(points: Coordinates[], brouterProfile: string, privateRoads: boolean): Promise<TrackPoint[]> {
    let url = `https://routing.gpx.studio?lonlats=${points.map(point => `${point.lon.toFixed(8)},${point.lat.toFixed(8)}`).join('|')}&profile=${brouterProfile + (privateRoads ? '-private' : '')}&format=geojson&alternativeidx=0`;

    let response = await fetch(url);

    // Check if the response is ok
    if (!response.ok) {
        throw new Error(`${await response.text()}`);
    }

    let geojson = await response.json();

    let route: TrackPoint[] = [];
    let coordinates = geojson.features[0].geometry.coordinates;
    let messages = geojson.features[0].properties.messages;

    const lngIdx = messages[0].indexOf("Longitude");
    const latIdx = messages[0].indexOf("Latitude");
    const tagIdx = messages[0].indexOf("WayTags");
    let messageIdx = 1;
    let surface = getSurface(messages[messageIdx][tagIdx]);

    for (let i = 0; i < coordinates.length; i++) {
        let coord = coordinates[i];
        route.push(new TrackPoint({
            attributes: {
                lat: coord[1],
                lon: coord[0]
            },
            ele: coord[2] ?? undefined
        }));
        route[route.length - 1].setSurface(surface)

        if (messageIdx < messages.length &&
            coordinates[i][0] == Number(messages[messageIdx][lngIdx]) / 1000000 &&
            coordinates[i][1] == Number(messages[messageIdx][latIdx]) / 1000000) {
            messageIdx++;

            if (messageIdx == messages.length) surface = "unknown";
            else surface = getSurface(messages[messageIdx][tagIdx]);
        }
    }

    return route;
}

function getSurface(message: string): string {
    const fields = message.split(" ");
    for (let i = 0; i < fields.length; i++) if (fields[i].startsWith("surface=")) {
        return fields[i].substring(8);
    }
    return "unknown";
};