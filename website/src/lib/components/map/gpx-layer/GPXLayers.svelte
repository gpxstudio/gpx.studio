<script lang="ts">
    import { gpxLayers } from '$lib/components/map/gpx-layer/gpx-layers';
    import { onMount } from 'svelte';
    // import { map, gpxLayers } from '$lib/stores';
    // import { GPXLayer } from './gpx-layer';
    // import { DistanceMarkers } from './DistanceMarkers';
    // import { StartEndMarkers } from './StartEndMarkers';
    // import { onDestroy } from 'svelte';
    // import { createPopups, removePopups } from './GPXLayerPopup';

    // let distanceMarkers = $derived(map.current ? new DistanceMarkers(map.current) : undefined);
    // let startEndMarkers = $derived(map.current ? new StartEndMarkers(map.current) : undefined);

    // $: if ($map) {
    //     if (distanceMarkers) {
    //         distanceMarkers.remove();
    //     }
    //     if (startEndMarkers) {
    //         startEndMarkers.remove();
    //     }
    //     createPopups($map);
    //     distanceMarkers = new DistanceMarkers($map);
    //     startEndMarkers = new StartEndMarkers($map);
    // }

    // onDestroy(() => {
    //     removePopups();
    //     if (distanceMarkers) {
    //         distanceMarkers.remove();
    //         distanceMarkers = undefined;
    //     }
    //     if (startEndMarkers) {
    //         startEndMarkers.remove();
    //         startEndMarkers = undefined;
    //     }
    // });

    onMount(() => {
        gpxLayers.init();
    });
</script>
