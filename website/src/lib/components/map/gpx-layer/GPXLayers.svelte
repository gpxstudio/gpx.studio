<script lang="ts">
    import { onDestroy } from 'svelte';
    import { gpxLayers } from '$lib/components/map/gpx-layer/gpx-layers';
    import { DistanceMarkers } from '$lib/components/map/gpx-layer/distance-markers';
    import { StartEndMarkers } from '$lib/components/map/gpx-layer/start-end-markers';
    import { createPopups, removePopups } from '$lib/components/map/gpx-layer/gpx-layer-popup';
    import { map } from '$lib/components/map/map';
    import { hoveredTrackpoint } from '$lib/state/selection-statistics';

    let distanceMarkers: DistanceMarkers;
    let startEndMarkers: StartEndMarkers;

    map.onLoad((map_) => {
        gpxLayers.init();
        startEndMarkers = new StartEndMarkers();
        distanceMarkers = new DistanceMarkers();
        createPopups(map_);
        // the layers do not see the pointer when it leaves the map or when it drags something
        const stopHovering = () => hoveredTrackpoint.set(null);
        map_.on('mouseout', stopHovering);
        map_.on('mousedown', stopHovering);
        map_.on('movestart', stopHovering);
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
