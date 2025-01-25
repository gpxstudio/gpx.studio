<script lang="ts">
	import { map } from '$lib/stores';
	import { trackpointPopup } from '$lib/components/gpx-layer/GPXLayerPopup';
	import { TrackPoint } from 'gpx';

	$: if ($map) {
		$map.on('contextmenu', (e) => {
			trackpointPopup?.setItem({
				item: new TrackPoint({
					attributes: {
						lat: e.lngLat.lat,
						lon: e.lngLat.lng
					}
				})
			});
		});
	}
</script>
