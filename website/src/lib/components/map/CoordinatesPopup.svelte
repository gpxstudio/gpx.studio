<script lang="ts">
    import { map } from '$lib/components/map/map';
    import { trackpointPopup } from '$lib/components/map/gpx-layer/gpx-layer-popup';
    import { TrackPoint } from 'gpx';

    map.onLoad((map_) => {
        map_.on('contextmenu', (e) => {
            if (map_.queryRenderedFeatures(e.point, { layers: ['routing-controls'] }).length) {
                // Clicked on routing control, ignoring
                return;
            }
            trackpointPopup?.setItem({
                item: new TrackPoint({
                    attributes: {
                        lat: e.lngLat.lat,
                        lon: e.lngLat.lng,
                    },
                }),
            });
        });
    });
</script>
