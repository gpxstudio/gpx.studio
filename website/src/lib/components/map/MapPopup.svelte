<script lang="ts">
    import { TrackPoint, Waypoint } from 'gpx';
    import WaypointPopup from '$lib/components/map/gpx-layer/WaypointPopup.svelte';
    import TrackpointPopup from '$lib/components/map/gpx-layer/TrackpointPopup.svelte';
    import OverpassPopup from '$lib/components/map/layer-control/OverpassPopup.svelte';
    import type { PopupItem } from '$lib/components/map/map-popup';
    import type { Writable } from 'svelte/store';

    let {
        item,
        onContainerReady,
    }: { item: Writable<PopupItem | null>; onContainerReady: (div: HTMLDivElement) => void } =
        $props();

    let container: HTMLDivElement | null = $state(null);

    $effect(() => {
        if (container) {
            onContainerReady(container);
        }
    });
</script>

<div bind:this={container}>
    {#if $item}
        {#if $item.item instanceof Waypoint}
            <WaypointPopup waypoint={$item} />
        {:else if $item.item instanceof TrackPoint}
            <TrackpointPopup trackpoint={$item} />
        {:else}
            <OverpassPopup poi={$item} />
        {/if}
    {/if}
</div>
