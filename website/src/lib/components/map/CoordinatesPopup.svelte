<script lang="ts">
    import { map } from '$lib/components/map/map.svelte';
    import { trackpointPopup } from '$lib/components/map/gpx-layer/GPXLayerPopup';
    import { TrackPoint } from 'gpx';

    $effect(() => {
        if (map.current) {
            map.current.on('contextmenu', (e) => {
                trackpointPopup?.setItem({
                    item: new TrackPoint({
                        attributes: {
                            lat: e.lngLat.lat,
                            lon: e.lngLat.lng,
                        },
                    }),
                });
            });
        }
    });
</script>
