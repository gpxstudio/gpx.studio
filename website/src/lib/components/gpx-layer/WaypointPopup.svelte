<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { waypointPopup, currentWaypoint } from './WaypointPopup';
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
	{#if $currentWaypoint}
		<Card.Root class="border-none shadow-md text-base max-w-72 p-2">
			<Card.Header class="p-0">
				<Card.Title class="text-md">{$currentWaypoint.name}</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col p-0 text-sm">
				<div class="flex flex-row items-center text-muted-foreground">
					{$currentWaypoint.getLatitude().toFixed(6)}&deg; {$currentWaypoint
						.getLongitude()
						.toFixed(6)}&deg;
					{#if $currentWaypoint.ele !== undefined}
						<Dot size="16" />
						<WithUnits value={$currentWaypoint.ele} type="elevation" />
					{/if}
				</div>
				{#if $currentWaypoint.desc}
					<span>{$currentWaypoint.desc}</span>
				{/if}
				{#if $currentWaypoint.cmt}
					<span>{$currentWaypoint.cmt}</span>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
