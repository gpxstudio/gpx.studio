<svelte:options accessors />

<script lang="ts">
	import { TrackPoint, Waypoint } from 'gpx';
	import type { Writable } from 'svelte/store';
	import WaypointPopup from '$lib/components/gpx-layer/WaypointPopup.svelte';
	import TrackpointPopup from '$lib/components/gpx-layer/TrackpointPopup.svelte';
	import OverpassPopup from '$lib/components/layer-control/OverpassPopup.svelte';
	import type { PopupItem } from './MapPopup';

	export let item: Writable<PopupItem | null>;
	export let container: HTMLDivElement | null = null;
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
