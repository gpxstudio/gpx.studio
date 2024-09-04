<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { waypointPopup, currentPopupWaypoint, deleteWaypoint } from './WaypointPopup';
	import WithUnits from '$lib/components/WithUnits.svelte';
	import { Dot, ExternalLink, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { Tool, currentTool } from '$lib/stores';
	import { getSymbolKey, symbols } from '$lib/assets/symbols';
	import { _ } from 'svelte-i18n';
	import sanitizeHtml from 'sanitize-html';

	let popupElement: HTMLDivElement;

	onMount(() => {
		waypointPopup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});

	$: symbolKey = $currentPopupWaypoint ? getSymbolKey($currentPopupWaypoint[0].sym) : undefined;

	function sanitize(text: string | undefined): string {
		if (text === undefined) {
			return '';
		}
		return sanitizeHtml(text, {
			allowedTags: ['a', 'br', 'img'],
			allowedAttributes: {
				a: ['href', 'target'],
				img: ['src']
			}
		}).trim();
	}
</script>

<div bind:this={popupElement} class="hidden">
	{#if $currentPopupWaypoint}
		<Card.Root class="border-none shadow-md text-base max-w-80 p-2">
			<Card.Header class="p-0">
				<Card.Title class="text-md">
					{#if $currentPopupWaypoint[0].link && $currentPopupWaypoint[0].link.attributes && $currentPopupWaypoint[0].link.attributes.href}
						<a href={$currentPopupWaypoint[0].link.attributes.href} target="_blank">
							{$currentPopupWaypoint[0].name ?? $currentPopupWaypoint[0].link.attributes.href}
							<ExternalLink size="12" class="inline-block mb-1.5" />
						</a>
					{:else}
						{$currentPopupWaypoint[0].name ?? $_('gpx.waypoint')}
					{/if}
				</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col p-0 text-sm">
				<div class="flex flex-row items-center text-muted-foreground text-xs whitespace-nowrap">
					{#if symbolKey}
						<span>
							{#if symbols[symbolKey].icon}
								<svelte:component
									this={symbols[symbolKey].icon}
									size="12"
									class="inline-block mb-0.5"
								/>
							{:else}
								<span class="w-4 inline-block" />
							{/if}
							{$_(`gpx.symbol.${symbolKey}`)}
						</span>
						<Dot size="16" />
					{/if}
					{$currentPopupWaypoint[0].getLatitude().toFixed(6)}&deg; {$currentPopupWaypoint[0]
						.getLongitude()
						.toFixed(6)}&deg;
					{#if $currentPopupWaypoint[0].ele !== undefined}
						<Dot size="16" />
						<WithUnits value={$currentPopupWaypoint[0].ele} type="elevation" />
					{/if}
				</div>
				{#if $currentPopupWaypoint[0].desc}
					<span class="whitespace-pre-wrap">{@html sanitize($currentPopupWaypoint[0].desc)}</span>
				{/if}
				{#if $currentPopupWaypoint[0].cmt && $currentPopupWaypoint[0].cmt !== $currentPopupWaypoint[0].desc}
					<span class="whitespace-pre-wrap">{@html sanitize($currentPopupWaypoint[0].cmt)}</span>
				{/if}
				{#if $currentTool === Tool.WAYPOINT}
					<Button
						class="mt-2 w-full px-2 py-1 h-8 justify-start"
						variant="outline"
						on:click={() =>
							deleteWaypoint($currentPopupWaypoint[1], $currentPopupWaypoint[0]._data.index)}
					>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete')}
						<Shortcut key="" shift={true} click={true} />
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<style lang="postcss">
	div :global(a) {
		@apply text-blue-500 dark:text-blue-300;
		@apply hover:underline;
	}

	div :global(img) {
		@apply my-0;
		@apply rounded-md;
	}
</style>
