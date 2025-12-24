import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { base } from '$app/paths';
import { languages } from '$lib/languages';
import { TrackPoint, Waypoint, type Coordinates, crossarcDistance, distance, GPXFile } from 'gpx';
import mapboxgl from 'mapbox-gl';
import { pointToTile, pointToTileFraction } from '@mapbox/tilebelt';
import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
import PNGReader from 'png.js';
import type { GPXStatisticsTree } from '$lib/logic/statistics-tree';
import { ListTrackSegmentItem } from '$lib/components/file-list/file-list';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
    ref?: U | null;
};

export function getClosestLinePoint(
    points: TrackPoint[],
    point: TrackPoint | Coordinates,
    details: any = {}
): TrackPoint {
    let closest = points[0];
    let closestDist = Number.MAX_VALUE;
    for (let i = 0; i < points.length - 1; i++) {
        let dist = crossarcDistance(points[i], points[i + 1], point);
        if (dist < closestDist) {
            closestDist = dist;
            if (distance(points[i], point) <= distance(points[i + 1], point)) {
                closest = points[i];
                details['before'] = true;
                details['index'] = i;
            } else {
                closest = points[i + 1];
                details['before'] = false;
                details['index'] = i + 1;
            }
        }
    }
    details['distance'] = closestDist;
    return closest;
}

export function getClosestTrackSegments(
    file: GPXFile,
    statistics: GPXStatisticsTree,
    point: Coordinates
): [number, number][] {
    let segmentBoundsDistances: [number, number, number][] = [];
    file.forEachSegment((segment, trackIndex, segmentIndex) => {
        let segmentStatistics = statistics.getStatisticsFor(
            new ListTrackSegmentItem(file._data.id, trackIndex, segmentIndex)
        );
        let segmentBounds = segmentStatistics.global.bounds;
        let northEast = segmentBounds.northEast;
        let southWest = segmentBounds.southWest;
        let bounds = new mapboxgl.LngLatBounds(southWest, northEast);
        if (bounds.contains(point)) {
            segmentBoundsDistances.push([0, trackIndex, segmentIndex]);
        } else {
            let northWest: Coordinates = { lat: northEast.lat, lon: southWest.lon };
            let southEast: Coordinates = { lat: southWest.lat, lon: northEast.lon };
            let distanceToBounds = Math.min(
                crossarcDistance(northWest, northEast, point),
                crossarcDistance(northEast, southEast, point),
                crossarcDistance(southEast, southWest, point),
                crossarcDistance(southWest, northWest, point)
            );
            segmentBoundsDistances.push([distanceToBounds, trackIndex, segmentIndex]);
        }
    });
    segmentBoundsDistances.sort((a, b) => a[0] - b[0]);

    let closest: { distance: number; indices: [number, number][] } = {
        distance: Number.MAX_VALUE,
        indices: [],
    };
    for (let s = 0; s < segmentBoundsDistances.length; s++) {
        if (segmentBoundsDistances[s][0] > closest.distance) {
            break;
        }
        const segment = file.getSegment(segmentBoundsDistances[s][1], segmentBoundsDistances[s][2]);
        segment.trkpt.forEach((pt) => {
            let dist = distance(pt.getCoordinates(), point);
            if (dist < closest.distance) {
                closest.distance = dist;
                closest.indices = [[segmentBoundsDistances[s][1], segmentBoundsDistances[s][2]]];
            } else if (dist === closest.distance) {
                closest.indices.push([segmentBoundsDistances[s][1], segmentBoundsDistances[s][2]]);
            }
        });
    }

    return closest.indices;
}

export function getElevation(
    points: (TrackPoint | Waypoint | Coordinates)[],
    ELEVATION_ZOOM: number = 13,
    tileSize = 512
): Promise<number[]> {
    let coordinates = points.map((point) =>
        point instanceof TrackPoint || point instanceof Waypoint ? point.getCoordinates() : point
    );
    let bbox = new mapboxgl.LngLatBounds();
    coordinates.forEach((coord) => bbox.extend(coord));

    let tiles = coordinates.map((coord) => pointToTile(coord.lon, coord.lat, ELEVATION_ZOOM));
    let uniqueTiles = Array.from(new Set(tiles.map((tile) => tile.join(',')))).map((tile) =>
        tile.split(',').map((x) => parseInt(x))
    );
    let pngs = new Map<string, any>();

    let promises = uniqueTiles.map((tile) =>
        fetch(
            `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${ELEVATION_ZOOM}/${tile[0]}/${tile[1]}@2x.pngraw?access_token=${PUBLIC_MAPBOX_TOKEN}`,
            { cache: 'force-cache' }
        )
            .then((response) => response.arrayBuffer())
            .then(
                (buffer) =>
                    new Promise((resolve) => {
                        let png = new PNGReader(new Uint8Array(buffer));
                        png.parse((err, png) => {
                            if (err) {
                                resolve(false); // Also resolve so that Promise.all doesn't fail
                            } else {
                                pngs.set(tile.join(','), png);
                                resolve(true);
                            }
                        });
                    })
            )
    );

    return Promise.all(promises).then(() =>
        coordinates.map((coord, index) => {
            let tile = tiles[index];
            let png = pngs.get(tile.join(','));

            if (!png) {
                return 0;
            }

            let tf = pointToTileFraction(coord.lon, coord.lat, ELEVATION_ZOOM);
            let x = tileSize * (tf[0] - tile[0]);
            let y = tileSize * (tf[1] - tile[1]);
            let _x = Math.floor(x);
            let _y = Math.floor(y);
            let dx = x - _x;
            let dy = y - _y;

            const p00 = png.getPixel(_x, _y);
            const p01 = png.getPixel(_x, _y + (_y + 1 == tileSize ? 0 : 1));
            const p10 = png.getPixel(_x + (_x + 1 == tileSize ? 0 : 1), _y);
            const p11 = png.getPixel(
                _x + (_x + 1 == tileSize ? 0 : 1),
                _y + (_y + 1 == tileSize ? 0 : 1)
            );

            let ele00 = -10000 + (p00[0] * 256 * 256 + p00[1] * 256 + p00[2]) * 0.1;
            let ele01 = -10000 + (p01[0] * 256 * 256 + p01[1] * 256 + p01[2]) * 0.1;
            let ele10 = -10000 + (p10[0] * 256 * 256 + p10[1] * 256 + p10[2]) * 0.1;
            let ele11 = -10000 + (p11[0] * 256 * 256 + p11[1] * 256 + p11[2]) * 0.1;

            return (
                ele00 * (1 - dx) * (1 - dy) +
                ele01 * (1 - dx) * dy +
                ele10 * dx * (1 - dy) +
                ele11 * dx * dy
            );
        })
    );
}

export function isMac() {
    return navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

export function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function getURLForLanguage(lang: string, path: string): string {
    let newPath = path.replace(base, '');

    let languageInPath = newPath.split('/')[1];
    if (!languages.hasOwnProperty(languageInPath)) {
        languageInPath = 'en';
    }

    if (newPath === '/' && lang !== 'en') {
        newPath = '';
    }

    if (languageInPath === 'en') {
        if (lang === 'en') {
            return `${base}${newPath}`;
        } else {
            return `${base}/${lang}${newPath}`;
        }
    } else {
        if (lang === 'en') {
            newPath = newPath.replace(`/${languageInPath}`, '');
            return newPath === '' ? `${base}/` : `${base}${newPath}`;
        } else {
            newPath = newPath.replace(`/${languageInPath}`, `/${lang}`);
            return `${base}${newPath}`;
        }
    }
}
