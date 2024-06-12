<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { waypointPopup, currentPopupWaypoint } from './WaypointPopup';
	import WithUnits from '$lib/components/WithUnits.svelte';
	import { Dot } from 'lucide-svelte';
	import { onMount } from 'svelte';

	import { _ } from 'svelte-i18n';

	let popupElement: HTMLDivElement;

	onMount(() => {
		waypointPopup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});
</script>

<div bind:this={popupElement} class="hidden">
	{#if $currentPopupWaypoint}
		<Card.Root class="border-none shadow-md text-base max-w-72 p-2">
			<Card.Header class="p-0">
				<Card.Title class="text-md">{$currentPopupWaypoint.name}</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col p-0 text-sm">
				<div class="flex flex-row items-center text-muted-foreground">
					{$currentPopupWaypoint.getLatitude().toFixed(6)}&deg; {$currentPopupWaypoint
						.getLongitude()
						.toFixed(6)}&deg;
					{#if $currentPopupWaypoint.ele !== undefined}
						<Dot size="16" />
						<WithUnits value={$currentPopupWaypoint.ele} type="elevation" />
					{/if}
				</div>
				{#if $currentPopupWaypoint.desc}
					<span>{$currentPopupWaypoint.desc}</span>
				{/if}
				{#if $currentPopupWaypoint.cmt}
					<span>{$currentPopupWaypoint.cmt}</span>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
