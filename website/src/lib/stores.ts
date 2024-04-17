import { writable } from 'svelte/store';

import mapboxgl from 'mapbox-gl';

export const map = writable<mapboxgl.Map | null>(null);