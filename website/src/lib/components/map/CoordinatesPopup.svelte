<script lang="ts">
    import { map } from '$lib/components/map/map';
    import { trackpointPopup } from '$lib/components/map/gpx-layer/gpx-layer-popup';

    map.onLoad((map_) => {
        map_.on('contextmenu', (e) => {
            if (
                map_.queryRenderedFeatures(e.point, {
                    layers: map_
                        .getLayersOrder()
                        .filter((layerId) => layerId.startsWith('routing-controls')),
                }).length
            ) {
                // Clicked on routing control, ignoring
                return;
            }
            trackpointPopup?.setItem({
                kind: 'trackpoint',
                item: { lng: e.lngLat.lng, lat: e.lngLat.lat },
            });
        });
    });
</script>
