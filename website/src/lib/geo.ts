export type Coordinates = {
    lat: number;
    lng: number;
};

const EARTH_RADIUS = 6371008.8;

/** The distance in meters between two coordinates (haversine formula). */
export function distance(a: Coordinates, b: Coordinates): number {
    const rad = Math.PI / 180;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;
    const dLat = lat2 - lat1;
    const dLng = (b.lng - a.lng) * rad;
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return EARTH_RADIUS * 2 * Math.asin(Math.sqrt(Math.min(h, 1)));
}
