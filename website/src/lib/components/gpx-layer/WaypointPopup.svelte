<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { waypointPopup, currentPopupWaypoint, deleteWaypoint } from './WaypointPopup';
	import WithUnits from '$lib/components/WithUnits.svelte';
	import { Dot, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Tool, currentTool } from '$lib/stores';
	import { _ } from 'svelte-i18n';

	let popupElement: HTMLDivElement;

	onMount(() => {
		waypointPopup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});
</script>

<div bind:this={popupElement} class="hidden">
	{#if $currentPopupWaypoint}
		<Card.Root class="border-none shadow-md text-base max-w-80 p-2">
			<Card.Header class="p-0">
				<Card.Title class="text-md">{$currentPopupWaypoint[0].name}</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col p-0 text-sm">
				<div class="flex flex-row items-center text-muted-foreground">
					{$currentPopupWaypoint[0].getLatitude().toFixed(6)}&deg; {$currentPopupWaypoint[0]
						.getLongitude()
						.toFixed(6)}&deg;
					{#if $currentPopupWaypoint[0].ele !== undefined}
						<Dot size="16" />
						<WithUnits value={$currentPopupWaypoint[0].ele} type="elevation" />
					{/if}
				</div>
				{#if $currentPopupWaypoint[0].desc}
					<span>{$currentPopupWaypoint[0].desc}</span>
				{/if}
				{#if $currentPopupWaypoint[0].cmt && $currentPopupWaypoint[0].cmt !== $currentPopupWaypoint[0].desc}
					<span>{$currentPopupWaypoint[0].cmt}</span>
				{/if}
				{#if $currentTool === Tool.WAYPOINT}
					<div class="mt-2">
						<Button
							class="w-full px-2 py-1 h-6 justify-start"
							variant="ghost"
							on:click={() =>
								deleteWaypoint($currentPopupWaypoint[1], $currentPopupWaypoint[0]._data.index)}
						>
							<Trash2 size="16" class="mr-1" />
							{$_('menu.delete')}
							<Shortcut key="" shift={true} click={true} />
						</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
