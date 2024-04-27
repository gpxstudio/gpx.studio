<script lang="ts">
	import { onMount } from 'svelte';

	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

	import { map, settings } from '$lib/stores';
	import { locale } from 'svelte-i18n';
	import { get } from 'svelte/store';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiZ3B4c3R1ZGlvIiwiYSI6ImNrdHVoM2pjNTBodmUycG1yZTNwcnJ3MzkifQ.YZnNs9s9oCQPzoXAWs_SLg';

	let fitBoundsOptions: mapboxgl.FitBoundsOptions = {
		maxZoom: 15,
		linear: true,
		easing: () => 1
	};

	let scaleControl = new mapboxgl.ScaleControl({
		unit: $settings.distanceUnits
	});

	function toggleTerrain() {
		if ($map) {
			if ($map.getPitch() > 0) {
				if (!$map.getSource('mapbox-dem')) {
					$map.addSource('mapbox-dem', {
						type: 'raster-dem',
						url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
						tileSize: 512,
						maxzoom: 14
					});
				}
				if (!$map.getTerrain()) {
					$map.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
					$map.setFog({
						color: 'rgb(186, 210, 235)',
						'high-color': 'rgb(36, 92, 223)',
						'horizon-blend': 0.1,
						'space-color': 'rgb(156, 240, 255)'
					});
				}
			} else {
				$map.setTerrain(null);
			}
		}
	}

	onMount(() => {
		$map = new mapboxgl.Map({
			container: 'map',
			style: { version: 8, sources: {}, layers: [] },
			projection: { name: 'mercator' },
			hash: true,
			language: get(locale),
			attributionControl: false,
			logoPosition: 'bottom-right',
			boxZoom: false
		});

		$map.addControl(
			new mapboxgl.AttributionControl({
				compact: true
			})
		);

		$map.addControl(new mapboxgl.NavigationControl());

		$map.addControl(
			new MapboxGeocoder({
				accessToken: mapboxgl.accessToken,
				mapboxgl: mapboxgl,
				collapsed: true,
				flyTo: fitBoundsOptions,
				language: get(locale)
			})
		);

		$map.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				fitBoundsOptions,
				trackUserLocation: true,
				showUserHeading: true
			})
		);

		$map.addControl(scaleControl);

		$map.on('style.load', toggleTerrain);
		$map.on('pitchstart', toggleTerrain);
	});

	$: if ($map) {
		scaleControl.setUnit($settings.distanceUnits);
	}
</script>

<div {...$$restProps}>
	<div id="map" class="h-full"></div>
</div>

<style lang="postcss">
	div :global(.mapboxgl-map) {
		@apply font-sans;
	}

	div :global(.mapboxgl-ctrl-top-right > .mapboxgl-ctrl) {
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
		@apply z-20;
		@apply flex;
		@apply flex-col;
		@apply items-end;
		@apply h-full;
		@apply overflow-hidden;
	}

	div :global(.mapboxgl-ctrl-bottom-left) {
		@apply bottom-[42px];
	}

	div :global(.mapboxgl-ctrl-bottom-right) {
		@apply bottom-[42px];
	}

	div :global(.mapboxgl-popup) {
		@apply w-fit;
		@apply z-20;
	}

	div :global(.mapboxgl-popup-content) {
		@apply p-0;
		@apply bg-transparent;
		@apply shadow-none;
	}

	div :global(.mapboxgl-popup-tip) {
		@apply drop-shadow-md;
	}
</style>
