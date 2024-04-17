<script lang="ts">
	import { GPXFile } from 'gpx';

	import { map } from '$lib/stores';

	export let file: GPXFile;

	$: if ($map) {
		$map.on('load', () => {
			$map.addSource('gpx', {
				type: 'geojson',
				data: file.toGeoJSON()
			});
			$map.addLayer({
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
