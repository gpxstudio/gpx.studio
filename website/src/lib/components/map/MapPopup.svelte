<script lang="ts">
    import { TrackPoint, Waypoint } from 'gpx';
    import WaypointPopup from '$lib/components/map/gpx-layer/WaypointPopup.svelte';
    import TrackpointPopup from '$lib/components/map/gpx-layer/TrackpointPopup.svelte';
    import OverpassPopup from '$lib/components/map/layer-control/OverpassPopup.svelte';
    import type { PopupItem } from '$lib/components/map/map.svelte';

    let { item, container = null }: { item: PopupItem | null; container: HTMLDivElement | null } =
        $props();
</script>

<div bind:this={container}>
    {#if item}
        {#if item.item instanceof Waypoint}
            <WaypointPopup waypoint={item} />
        {:else if item.item instanceof TrackPoint}
            <TrackpointPopup trackpoint={item} />
        {:else}
            <OverpassPopup poi={item} />
        {/if}
    {/if}
</div>
