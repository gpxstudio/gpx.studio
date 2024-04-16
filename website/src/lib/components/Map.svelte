<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiZ3B4c3R1ZGlvIiwiYSI6ImNrdHVoM2pjNTBodmUycG1yZTNwcnJ3MzkifQ.YZnNs9s9oCQPzoXAWs_SLg';

	export let map: mapboxgl.Map | null = null;
	export let distanceUnits: 'metric' | 'imperial' = 'metric';

	onMount(() => {
		map = new mapboxgl.Map({
			container: 'map',
			style: { version: 8, sources: {}, layers: [] },
			projection: { name: 'mercator' },
			hash: true,
			language: 'auto',
			attributionControl: false,
			logoPosition: 'bottom-right'
		});

		map.addControl(
			new mapboxgl.AttributionControl({
				compact: true
			})
		);

		map.addControl(new mapboxgl.NavigationControl());

		map.addControl(
			new MapboxGeocoder({
				accessToken: mapboxgl.accessToken,
				mapboxgl: mapboxgl,
				collapsed: true
			})
		);

		map.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true,
				showUserHeading: true
			})
		);

		map.addControl(
			new mapboxgl.ScaleControl({
				unit: distanceUnits
			})
		);
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});
</script>

<div {...$$restProps}>
	<div id="map" class="h-full"></div>
</div>

<style lang="postcss">
	div :global(.mapboxgl-ctrl) {
		@apply shadow-md;
	}

	div :global(.mapboxgl-ctrl-geocoder) {
		@apply flex;
		@apply flex-row;
		@apply w-fit;
		@apply min-w-fit;
		@apply items-center;
		@apply shadow-md;
	}

	div :global(.suggestions) {
		@apply shadow-md;
	}

	div :global(.mapboxgl-ctrl-geocoder--icon-search) {
		@apply fill-inherit;
		@apply relative;
		@apply top-0;
		@apply left-0;
		@apply my-2;
		@apply w-[29px];
	}

	div :global(.mapboxgl-ctrl-geocoder--input) {
		@apply relative;
		@apply w-64;
		@apply py-0;
		@apply pl-2;
		@apply focus:outline-none;
		@apply transition-[width];
		@apply duration-200;
	}

	div :global(.mapboxgl-ctrl-geocoder--collapsed .mapboxgl-ctrl-geocoder--input) {
		@apply w-0;
		@apply p-0;
	}

	div :global(.mapboxgl-ctrl-top-right) {
		@apply z-10;
		@apply flex;
		@apply flex-col;
		@apply items-end;
		@apply h-full;
		@apply overflow-hidden;
	}
</style>
