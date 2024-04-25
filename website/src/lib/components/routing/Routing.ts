import type { Coordinates } from "gpx";
import { TrackPoint } from "gpx";
import { get, writable } from "svelte/store";
import { _ } from "svelte-i18n";

export const brouterProfiles: { [key: string]: string } = {
    bike: 'Trekking-dry',
    racing_bike: 'fastbike',
    mountain_bike: 'MTB',
    foot: 'Hiking-Alpine-SAC6',
    motorcycle: 'Car-FastEco',
    water: 'river',
    railway: 'rail'
};
export const routingProfile = writable({
    value: 'bike',
    label: get(_)('toolbar.routing.activities.bike')
});
export const routing = writable(true);
export const privateRoads = writable(false);

export function route(points: Coordinates[]): Promise<TrackPoint[]> {
    if (get(routing)) {
        return getRoute(points, brouterProfiles[get(routingProfile).value], get(privateRoads));
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
    let geojson = await response.json();

    let route: TrackPoint[] = [];
    let coordinates = geojson.features[0].geometry.coordinates;
    for (let i = 0; i < coordinates.length; i++) {
        let coord = coordinates[i];
        route.push(new TrackPoint({
            attributes: {
                lat: coord[1],
                lon: coord[0]
            },
            ele: coord[2] ?? undefined
        }));
    }

    return route;
}