import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
import { get } from "svelte/store";
import { map } from "./stores";
import { base } from "$app/paths";
import { languages } from "$lib/languages";
import { locale } from "svelte-i18n";
import { TrackPoint, Waypoint, type Coordinates, crossarcDistance, distance } from "gpx";
import mapboxgl from "mapbox-gl";
import tilebelt from "@mapbox/tilebelt";
import { PUBLIC_MAPBOX_TOKEN } from "$env/static/public";
import PNGReader from "png.js";
import type { DateFormatter } from "@internationalized/date";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type FlyAndScaleParams = {
    y?: number;
    x?: number;
    start?: number;
    duration?: number;
};

export const flyAndScale = (
    node: Element,
    params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 50 }
): TransitionConfig => {
    const style = getComputedStyle(node);
    const transform = style.transform === "none" ? "" : style.transform;

    const scaleConversion = (
        valueA: number,
        scaleA: [number, number],
        scaleB: [number, number]
    ) => {
        const [minA, maxA] = scaleA;
        const [minB, maxB] = scaleB;

        const percentage = (valueA - minA) / (maxA - minA);
        const valueB = percentage * (maxB - minB) + minB;

        return valueB;
    };

    const styleToString = (
        style: Record<string, number | string | undefined>
    ): string => {
        return Object.keys(style).reduce((str, key) => {
            if (style[key] === undefined) return str;
            return str + `${key}:${style[key]};`;
        }, "");
    };

    return {
        duration: params.duration ?? 200,
        delay: 0,
        css: (t) => {
            const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
            const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
            const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);

            return styleToString({
                transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                opacity: t
            });
        },
        easing: cubicOut
    };
};

export function getClosestLinePoint(points: TrackPoint[], point: TrackPoint | Coordinates, details: any = {}): TrackPoint {
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

export function getElevation(points: (TrackPoint | Waypoint | Coordinates)[], ELEVATION_ZOOM: number = 13, tileSize = 512): Promise<number[]> {
    let coordinates = points.map((point) => (point instanceof TrackPoint || point instanceof Waypoint) ? point.getCoordinates() : point);
    let bbox = new mapboxgl.LngLatBounds();
    coordinates.forEach((coord) => bbox.extend(coord));

    let tiles = coordinates.map((coord) => tilebelt.pointToTile(coord.lon, coord.lat, ELEVATION_ZOOM));
    let uniqueTiles = Array.from(new Set(tiles.map((tile) => tile.join(',')))).map((tile) => tile.split(',').map((x) => parseInt(x)));
    let pngs = new Map<string, any>();

    let promises = uniqueTiles.map((tile) => fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${ELEVATION_ZOOM}/${tile[0]}/${tile[1]}@2x.pngraw?access_token=${PUBLIC_MAPBOX_TOKEN}`, { cache: 'force-cache' }).then((response) => response.arrayBuffer()).then((buffer) => new Promise((resolve) => {
        let png = new PNGReader(new Uint8Array(buffer));
        png.parse((err, png) => {
            if (err) {
                resolve(false); // Also resolve so that Promise.all doesn't fail
            } else {
                pngs.set(tile.join(','), png);
                resolve(true);
            }
        });
    })));

    return Promise.all(promises).then(() => coordinates.map((coord, index) => {
        let tile = tiles[index];
        let png = pngs.get(tile.join(','));

        if (!png) {
            return 0;
        }

        let tf = tilebelt.pointToTileFraction(coord.lon, coord.lat, ELEVATION_ZOOM);
        let x = tileSize * (tf[0] - tile[0]);
        let y = tileSize * (tf[1] - tile[1]);
        let _x = Math.floor(x);
        let _y = Math.floor(y);
        let dx = x - _x;
        let dy = y - _y;

        const p00 = png.getPixel(_x, _y);
        const p01 = png.getPixel(_x, _y + (_y + 1 == tileSize ? 0 : 1));
        const p10 = png.getPixel(_x + (_x + 1 == tileSize ? 0 : 1), _y);
        const p11 = png.getPixel(_x + (_x + 1 == tileSize ? 0 : 1), _y + (_y + 1 == tileSize ? 0 : 1));

        let ele00 = -10000 + ((p00[0] * 256 * 256 + p00[1] * 256 + p00[2]) * 0.1);
        let ele01 = -10000 + ((p01[0] * 256 * 256 + p01[1] * 256 + p01[2]) * 0.1);
        let ele10 = -10000 + ((p10[0] * 256 * 256 + p10[1] * 256 + p10[2]) * 0.1);
        let ele11 = -10000 + ((p11[0] * 256 * 256 + p11[1] * 256 + p11[2]) * 0.1);

        return ele00 * (1 - dx) * (1 - dy) + ele01 * (1 - dx) * dy + ele10 * dx * (1 - dy) + ele11 * dx * dy;
    }));
}

let previousCursors: string[] = [];
export function setCursor(cursor: string) {
    let m = get(map);
    if (m) {
        previousCursors.push(m.getCanvas().style.cursor);
        m.getCanvas().style.cursor = cursor;
    }
}

export function resetCursor() {
    let m = get(map);
    if (m) {
        m.getCanvas().style.cursor = previousCursors.pop() ?? '';
    }
}

export function setPointerCursor() {
    setCursor('pointer');
}

export function setGrabbingCursor() {
    setCursor('grabbing');
}

export function setCrosshairCursor() {
    setCursor('crosshair');
}

export const scissorsCursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" version="1.1"><path d="M 3.200 3.200 C 0.441 5.959, 2.384 9.516, 7 10.154 C 10.466 10.634, 10.187 13.359, 6.607 13.990 C 2.934 14.637, 1.078 17.314, 2.612 19.750 C 4.899 23.380, 10 21.935, 10 17.657 C 10 16.445, 12.405 13.128, 15.693 9.805 C 18.824 6.641, 21.066 3.732, 20.674 3.341 C 20.283 2.950, 18.212 4.340, 16.072 6.430 C 12.019 10.388, 10 10.458, 10 6.641 C 10 2.602, 5.882 0.518, 3.200 3.200 M 4.446 5.087 C 3.416 6.755, 5.733 8.667, 7.113 7.287 C 8.267 6.133, 7.545 4, 6 4 C 5.515 4, 4.816 4.489, 4.446 5.087 M 14 14.813 C 14 16.187, 19.935 21.398, 20.667 20.667 C 21.045 20.289, 20.065 18.634, 18.490 16.990 C 15.661 14.036, 14 13.231, 14 14.813 M 4.446 17.087 C 3.416 18.755, 5.733 20.667, 7.113 19.287 C 8.267 18.133, 7.545 16, 6 16 C 5.515 16, 4.816 16.489, 4.446 17.087" stroke="black" stroke-width="1.2" fill="white" fill-rule="evenodd"/></svg>') 12 12, auto`;

export function setScissorsCursor() {
    setCursor(scissorsCursor);
}

export function isMac() {
    return navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
}

export function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function getURLForLanguage(lang: string | null | undefined, path: string): string {
    let newPath = path.replace(base, '');

    let languageInPath = newPath.split('/')[1];
    if (!languages.hasOwnProperty(languageInPath)) {
        languageInPath = 'en';
    }

    if (lang === null || lang === undefined) {
        lang = get(locale);
        if (lang === null || lang === undefined) {
            lang = 'en';
        }
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

function getDateFormatter(locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    });
}

export let df: DateFormatter = getDateFormatter('en');
locale.subscribe((l) => {
    df = getDateFormatter(l ?? 'en');
});