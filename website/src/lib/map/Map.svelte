<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
	import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';

	export let map: maplibregl.Map | null = null;

	onMount(() => {
		map = new maplibregl.Map({
			container: 'map',
			style: 'https://demotiles.maplibre.org/style.json'
		});

		map.addControl(
			new maplibregl.NavigationControl({
				showCompass: false
			})
		);

		map.addControl(
			new maplibregl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true
			})
		);

		const geocoderApi = {
			forwardGeocode: async (config) => {
				const features = [];
				try {
					const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geojson=1&addressdetails=1`;
					const response = await fetch(request);
					const geojson = await response.json();
					for (const feature of geojson.features) {
						const center = [
							feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
							feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2
						];
						const point = {
							type: 'Feature',
							geometry: {
								type: 'Point',
								coordinates: center
							},
							place_name: feature.properties.display_name,
							properties: feature.properties,
							text: feature.properties.display_name,
							place_type: ['place'],
							center
						};
						features.push(point);
					}
				} catch (e) {
					console.error(`Failed to forwardGeocode with error: ${e}`);
				}

				return {
					features
				};
			}
		};

		map.addControl(
			new MaplibreGeocoder(geocoderApi, {
				maplibregl,
				collapsed: true
			})
		);

		console.log(map);
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
