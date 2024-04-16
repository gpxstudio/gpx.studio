<script lang="ts">
	import mapboxgl from 'mapbox-gl';
	import { GPXFile } from 'gpx';

	export let file: GPXFile;
	export let map: mapboxgl.Map | null;

	$: if (map) {
		map.on('load', () => {
			console.log(map?.isStyleLoaded());
			map.addSource('gpx', {
				type: 'geojson',
				data: file.toGeoJSON()
			});
			map.addLayer({
				id: 'gpx',
				type: 'line',
				source: 'gpx',
				layout: {
					'line-join': 'round',
					'line-cap': 'round'
				},
				paint: {
					'line-color': '#888',
					'line-width': 8
				}
			});
		});
	}
</script>
