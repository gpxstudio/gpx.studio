<script lang="ts">
    import { onDestroy } from 'svelte';
    import { gpxLayers } from '$lib/components/map/gpx-layer/gpx-layers';
    import { DistanceMarkers } from '$lib/components/map/gpx-layer/distance-markers';
    import { StartEndMarkers } from '$lib/components/map/gpx-layer/start-end-markers';
    import { createPopups, removePopups } from '$lib/components/map/gpx-layer/gpx-layer-popup';
    import { map } from '$lib/components/map/map';

    let distanceMarkers: DistanceMarkers;
    let startEndMarkers: StartEndMarkers;

    map.onLoad((map_) => {
        gpxLayers.init();
        startEndMarkers = new StartEndMarkers();
        distanceMarkers = new DistanceMarkers();
        createPopups(map_);
    });

    onDestroy(() => {
        if (startEndMarkers) {
            startEndMarkers.remove();
        }
        if (distanceMarkers) {
            distanceMarkers.remove();
        }
        removePopups();
    });
</script>
