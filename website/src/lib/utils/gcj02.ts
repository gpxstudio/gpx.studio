import { get } from 'svelte/store';
import { settings } from '$lib/logic/settings';

const PI = Math.PI;
const A = 6378245.0; // Semi-major axis of GCJ-02 reference ellipsoid
const EE = 0.00669342162296594323; // First eccentricity squared

const gcj02Basemaps = new Set(['amapNormal', 'amapSatellite']);

const { currentBasemap } = settings;

function checkIsGCJ02(): boolean {
    return gcj02Basemaps.has(get(currentBasemap));
}

export const isGCJ02 = {
    subscribe(run: (value: boolean) => void, invalidate?: () => void) {
        return currentBasemap.subscribe((basemap) => {
            run(gcj02Basemaps.has(basemap));
        }, invalidate);
    },
};

function transformLat(lng: number, lat: number): number {
    let ret =
        -100.0 +
        2.0 * lng +
        3.0 * lat +
        0.2 * lat * lat +
        0.1 * lng * lat +
        0.2 * Math.sqrt(Math.abs(lng));
    ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
    ret +=
        ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
}

function transformLng(lng: number, lat: number): number {
    let ret =
        300.0 +
        lng +
        2.0 * lat +
        0.1 * lng * lng +
        0.1 * lng * lat +
        0.1 * Math.sqrt(Math.abs(lng));
    ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
    ret +=
        ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) /
        3.0;
    return ret;
}

function isInChina(lng: number, lat: number): boolean {
    return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
    if (!isInChina(lng, lat)) return [lng, lat];

    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
}

export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
    if (!isInChina(lng, lat)) return [lng, lat];

    // Iterative method for higher accuracy
    let wgsLng = lng,
        wgsLat = lat;
    for (let i = 0; i < 3; i++) {
        const [gcjLng, gcjLat] = wgs84ToGcj02(wgsLng, wgsLat);
        wgsLng += lng - gcjLng;
        wgsLat += lat - gcjLat;
    }
    return [wgsLng, wgsLat];
}

// Transform a {lon, lat} coordinate for display on a GCJ-02 basemap
export function displayCoord(coord: { lon: number; lat: number }): { lon: number; lat: number } {
    if (!checkIsGCJ02()) return coord;
    const [lng, lat] = wgs84ToGcj02(coord.lon, coord.lat);
    return { lon: lng, lat };
}

// Reverse-transform a map event {lng, lat} back to WGS-84
export function eventCoord(lngLat: { lng: number; lat: number }): {
    lng: number;
    lat: number;
} {
    if (!checkIsGCJ02()) return lngLat;
    const [lng, lat] = gcj02ToWgs84(lngLat.lng, lngLat.lat);
    return { lng, lat };
}

// Transform a [lng, lat] pair for display
export function displayLngLat(coord: { lon: number; lat: number }): { lon: number; lat: number } {
    return displayCoord(coord);
}

// Deep-transform all coordinates in a GeoJSON FeatureCollection for display
export function displayGeoJSON(
    geojson: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
    if (!checkIsGCJ02()) return geojson;

    return {
        ...geojson,
        features: geojson.features.map((feature) => ({
            ...feature,
            geometry: transformGeometry(feature.geometry),
        })),
    };
}

function transformGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
    switch (geometry.type) {
        case 'Point':
            return {
                ...geometry,
                coordinates: transformPosition(geometry.coordinates),
            };
        case 'MultiPoint':
        case 'LineString':
            return {
                ...geometry,
                coordinates: geometry.coordinates.map(transformPosition),
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                ...geometry,
                coordinates: geometry.coordinates.map((ring) => ring.map(transformPosition)),
            };
        case 'MultiPolygon':
            return {
                ...geometry,
                coordinates: geometry.coordinates.map((polygon) =>
                    polygon.map((ring) => ring.map(transformPosition))
                ),
            };
        case 'GeometryCollection':
            return {
                ...geometry,
                geometries: geometry.geometries.map(transformGeometry),
            };
        default:
            return geometry;
    }
}

function transformPosition(position: GeoJSON.Position): GeoJSON.Position {
    const [lng, lat, ...rest] = position;
    const [newLng, newLat] = wgs84ToGcj02(lng, lat);
    return [newLng, newLat, ...rest];
}

// Patch browser Geolocation API to return GCJ-02 coordinates when a GCJ-02 basemap is active.
// This fixes the GeolocateControl blue dot position on Gaode tiles.
export function patchGeolocationForGCJ02() {
    if (!navigator.geolocation) return;

    const origGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(
        navigator.geolocation
    );
    const origWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

    function wrapPosition(pos: GeolocationPosition): GeolocationPosition {
        if (!checkIsGCJ02()) return pos;
        const [lng, lat] = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude);
        return {
            coords: {
                latitude: lat,
                longitude: lng,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                toJSON: pos.coords.toJSON?.bind(pos.coords),
            } as GeolocationCoordinates,
            timestamp: pos.timestamp,
            toJSON: pos.toJSON?.bind(pos),
        } as GeolocationPosition;
    }

    navigator.geolocation.getCurrentPosition = function (success, error?, options?) {
        origGetCurrentPosition(
            (pos) => success(wrapPosition(pos)),
            error ?? null,
            options
        );
    };

    navigator.geolocation.watchPosition = function (success, error?, options?) {
        return origWatchPosition(
            (pos) => success(wrapPosition(pos)),
            error ?? null,
            options
        );
    };
}
