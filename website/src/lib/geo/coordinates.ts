import maplibregl from 'maplibre-gl';

export type Coordinates = {
    lat: number;
    lng: number;
};

/** The distance in meters between two coordinates (haversine formula). */
export function distance(a: Coordinates, b: Coordinates): number {
    return new maplibregl.LngLat(a.lng, a.lat).distanceTo(new maplibregl.LngLat(b.lng, b.lat));
}
