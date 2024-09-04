import type { Coordinates } from "gpx";
import { TrackPoint, distance } from "gpx";
import { derived, get, writable } from "svelte/store";
import { settings } from "$lib/db";
import { _, isLoading, locale } from "svelte-i18n";
import { map } from "$lib/stores";
import { getElevation } from "$lib/utils";

const { routing, routingProfile, privateRoads } = settings;

export const brouterProfiles: { [key: string]: string } = {
    bike: 'Trekking-dry',
    racing_bike: 'fastbike',
    gravel_bike: 'gravel',
    mountain_bike: 'MTB',
    foot: 'Hiking-Alpine-SAC6',
    motorcycle: 'Car-FastEco',
    water: 'river',
    railway: 'rail'
};
export const routingProfileSelectItem = writable({
    value: '',
    label: ''
});

derived([routingProfile, locale, isLoading], ([profile, l, i]) => [profile, l, i]).subscribe(([profile, l, i]) => {
    if (!i && profile !== '' && (profile !== get(routingProfileSelectItem).value || get(_)(`toolbar.routing.activities.${profile}`) !== get(routingProfileSelectItem).label) && l !== null) {
        routingProfileSelectItem.update((item) => {
            item.value = profile;
            item.label = get(_)(`toolbar.routing.activities.${profile}`);
            return item;
        });
    }
});
routingProfileSelectItem.subscribe((item) => {
    if (item.value !== '' && item.value !== get(routingProfile)) {
        routingProfile.set(item.value);
    }
});

export function route(points: Coordinates[]): Promise<TrackPoint[]> {
    if (get(routing)) {
        return getRoute(points, brouterProfiles[get(routingProfile)], get(privateRoads));
    } else {
        return getIntermediatePoints(points);
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
    let surface = messageIdx < messages.length ? getSurface(messages[messageIdx][tagIdx]) : "unknown";

    for (let i = 0; i < coordinates.length; i++) {
        let coord = coordinates[i];
        route.push(new TrackPoint({
            attributes: {
                lat: coord[1],
                lon: coord[0]
            },
            ele: coord[2] ?? (i > 0 ? route[i - 1].ele : 0)
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

function getIntermediatePoints(points: Coordinates[]): Promise<TrackPoint[]> {
    let route: TrackPoint[] = [];
    let step = 0.05;

    for (let i = 0; i < points.length - 1; i++) { // Add intermediate points between each pair of points
        let dist = distance(points[i], points[i + 1]) / 1000;
        for (let d = 0; d < dist; d += step) {
            let lat = points[i].lat + d / dist * (points[i + 1].lat - points[i].lat);
            let lon = points[i].lon + d / dist * (points[i + 1].lon - points[i].lon);
            route.push(new TrackPoint({
                attributes: {
                    lat: lat,
                    lon: lon
                }
            }));
        }
    }

    route.push(new TrackPoint({
        attributes: {
            lat: points[points.length - 1].lat,
            lon: points[points.length - 1].lon
        }
    }));

    return getElevation(route).then((elevations) => {
        route.forEach((point, i) => {
            point.setSurface("unknown");
            point.ele = elevations[i];
        });
        return route;
    });
}