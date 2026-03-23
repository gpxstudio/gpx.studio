<script lang="ts">
    import { map } from '$lib/components/map/map';
    import { trackpointPopup } from '$lib/components/map/gpx-layer/gpx-layer-popup';
    import { TrackPoint } from 'gpx';
    import { eventCoord } from '$lib/utils/gcj02';

    map.onLoad((map_) => {
        map_.on('contextmenu', (e) => {
            const ec = eventCoord(e.lngLat);
            trackpointPopup?.setItem({
                item: new TrackPoint({
                    attributes: {
                        lat: ec.lat,
                        lon: ec.lng,
                    },
                }),
            });
        });
    });
</script>
