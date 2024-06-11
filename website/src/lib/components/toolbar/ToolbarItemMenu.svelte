<script lang="ts">
	import { Tool, currentTool } from '$lib/stores';
	import { flyAndScale } from '$lib/utils';
	import * as Card from '$lib/components/ui/card';
	import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
	import Scissors from '$lib/components/toolbar/tools/Scissors.svelte';
	import Waypoint from '$lib/components/toolbar/tools/Waypoint.svelte';
	import Merge from '$lib/components/toolbar/tools/Merge.svelte';
	import Clean from '$lib/components/toolbar/tools/Clean.svelte';
	import Reduce from '$lib/components/toolbar/tools/Reduce.svelte';
	import RoutingControlPopup from '$lib/components/toolbar/tools/routing/RoutingControlPopup.svelte';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';

	let popupElement: HTMLElement;
	let popup: mapboxgl.Popup;

	onMount(() => {
		popup = new mapboxgl.Popup({
			closeButton: false,
			maxWidth: undefined
		});
		popup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});
</script>

{#if $currentTool !== null}
	<div
		in:flyAndScale={{ x: -2, y: 0, duration: 100 }}
		class="translate-x-1 h-full {$$props.class ?? ''}"
	>
		<div class="rounded-md shadow-md pointer-events-auto">
			<Card.Root class="rounded-md border-none">
				<Card.Content class="p-2.5">
					{#if $currentTool === Tool.ROUTING}
						<Routing {popup} {popupElement} />
					{:else if $currentTool === Tool.SCISSORS}
						<Scissors />
					{:else if $currentTool === Tool.WAYPOINT}
						<Waypoint />
					{:else if $currentTool === Tool.MERGE}
						<Merge />
					{:else if $currentTool === Tool.CLEAN}
						<Clean />
					{:else if $currentTool === Tool.REDUCE}
						<Reduce />
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{/if}

<svelte:window
	on:keydown={(e) => {
		if ($currentTool !== null && e.key === 'Escape') {
			currentTool.set(null);
		}
	}}
/>

<RoutingControlPopup bind:element={popupElement} />
