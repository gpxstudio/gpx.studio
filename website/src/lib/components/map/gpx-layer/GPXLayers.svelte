<script lang="ts">
    import { gpxLayers } from '$lib/components/map/gpx-layer/gpx-layers';
    import { onDestroy, onMount } from 'svelte';
    // import { map, gpxLayers } from '$lib/stores';
    // import { GPXLayer } from './gpx-layer';
    import { DistanceMarkers } from '$lib/components/map/gpx-layer/distance-markers';
    import { StartEndMarkers } from '$lib/components/map/gpx-layer/start-end-markers';
    // import { onDestroy } from 'svelte';
    // import { createPopups, removePopups } from './GPXLayerPopup';

    let distanceMarkers: DistanceMarkers;
    let startEndMarkers: StartEndMarkers;

    // $: if ($map) {
    //     createPopups($map);
    // }

    onMount(() => {
        gpxLayers.init();
        startEndMarkers = new StartEndMarkers();
        distanceMarkers = new DistanceMarkers();
    });

    onDestroy(() => {
        // removePopups();
        if (startEndMarkers) {
            startEndMarkers.remove();
        }
        if (distanceMarkers) {
            distanceMarkers.remove();
        }
    });
</script>
