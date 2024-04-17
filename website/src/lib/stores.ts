import { writable } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile } from 'gpx';

export const map = writable<mapboxgl.Map | null>(null);
export const files = writable<GPXFile[]>([]);