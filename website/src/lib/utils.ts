import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { base } from '$app/paths';
import { languages } from '$lib/languages';
import type { Coordinates } from '$lib/geo';
import maplibregl from 'maplibre-gl';
import { pointToTile, pointToTileFraction } from '@mapbox/tilebelt';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function getElevation(
    points: Coordinates[],
    ELEVATION_ZOOM: number = 12,
    tileSize = 512
): Promise<number[]> {
    let coordinates = points;
    let bbox = new maplibregl.LngLatBounds();
    coordinates.forEach((coord) => bbox.extend(coord));

    let tiles = coordinates.map((coord) => pointToTile(coord.lng, coord.lat, ELEVATION_ZOOM));
    let uniqueTiles = Array.from(new Set(tiles.map((tile) => tile.join(',')))).map((tile) =>
        tile.split(',').map((x) => parseInt(x))
    );
    let images = new Map<string, ImageData>();

    const getPixelFromImageData = (imageData: ImageData, x: number, y: number): number[] => {
        const index = (y * imageData.width + x) * 4;
        return [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]];
    };

    let promises = uniqueTiles.map((tile) =>
        fetch(`https://tiles.gpx.studio/mapterhorn/${ELEVATION_ZOOM}/${tile[0]}/${tile[1]}.webp`, {
            cache: 'force-cache',
        })
            .then((response) => response.blob())
            .then(
                (blob) =>
                    new Promise<void>((resolve) => {
                        const url = URL.createObjectURL(blob);
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(img, 0, 0);
                                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                                images.set(tile.join(','), imageData);
                            }
                            URL.revokeObjectURL(url);
                            resolve();
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(url);
                            resolve();
                        };
                        img.src = url;
                    })
            )
    );

    return Promise.all(promises).then(() =>
        coordinates.map((coord, index) => {
            let tile = tiles[index];
            let imageData = images.get(tile.join(','));

            if (!imageData) {
                return 0;
            }

            let tf = pointToTileFraction(coord.lng, coord.lat, ELEVATION_ZOOM);
            let x = tileSize * (tf[0] - tile[0]);
            let y = tileSize * (tf[1] - tile[1]);
            let _x = Math.floor(x);
            let _y = Math.floor(y);
            let dx = x - _x;
            let dy = y - _y;

            const p00 = getPixelFromImageData(imageData, _x, _y);
            const p01 = getPixelFromImageData(imageData, _x, _y + (_y + 1 == tileSize ? 0 : 1));
            const p10 = getPixelFromImageData(imageData, _x + (_x + 1 == tileSize ? 0 : 1), _y);
            const p11 = getPixelFromImageData(
                imageData,
                _x + (_x + 1 == tileSize ? 0 : 1),
                _y + (_y + 1 == tileSize ? 0 : 1)
            );

            let ele00 = -32768 + p00[0] * 256 + p00[1] + p00[2] / 256;
            let ele01 = -32768 + p01[0] * 256 + p01[1] + p01[2] / 256;
            let ele10 = -32768 + p10[0] * 256 + p10[1] + p10[2] / 256;
            let ele11 = -32768 + p11[0] * 256 + p11[1] + p11[2] / 256;

            return (
                ele00 * (1 - dx) * (1 - dy) +
                ele01 * (1 - dx) * dy +
                ele10 * dx * (1 - dy) +
                ele11 * dx * dy
            );
        })
    );
}

export function loadSVGIcon(map: maplibregl.Map, id: string, svg: string, size: number = 100) {
    if (!map.hasImage(id)) {
        let icon = new Image(size, size);
        icon.onload = () => {
            if (!map.hasImage(id)) {
                map.addImage(id, icon);
            }
        };
        icon.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
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
