<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { overpassPopup, overpassPopupPOI } from './OverpassLayer';
	import { selection } from '$lib/components/file-list/Selection';
	import { PencilLine, MapPin } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { dbUtils } from '$lib/db';

	let popupElement: HTMLDivElement;

	onMount(() => {
		overpassPopup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});

	let tags = {};
	$: if ($overpassPopupPOI) {
		tags = JSON.parse($overpassPopupPOI.tags);
	}
</script>

<div bind:this={popupElement} class="hidden">
	{#if $overpassPopupPOI}
		<Card.Root class="border-none shadow-md text-base p-2 max-w-[50dvw]">
			<Card.Header class="p-0">
				<Card.Title class="text-md">
					<div class="flex flex-row gap-3">
						<div class="flex flex-col">
							{tags.name ?? ''}
							<div class="text-muted-foreground text-sm font-normal">
								{$overpassPopupPOI.lat.toFixed(6)}&deg; {$overpassPopupPOI.lon.toFixed(6)}&deg;
							</div>
						</div>
						<Button
							class="ml-auto p-1.5 h-8"
							variant="outline"
							href="https://www.openstreetmap.org/edit?editor=id&node={$overpassPopupPOI.id}"
							target="_blank"
						>
							<PencilLine size="16" />
						</Button>
					</div>
				</Card.Title>
			</Card.Header>
			{#if tags.image || tags['image:0']}
				<div class="w-full rounded-md overflow-clip my-2 max-w-96 mx-auto">
					<img src={tags.image ?? tags['image:0']} />
				</div>
			{/if}
			<Card.Content class="flex flex-col p-0 text-sm mt-1 whitespace-normal break-all">
				<div class="grid grid-cols-[auto_auto] gap-x-3">
					{#each Object.entries(tags) as [key, value]}
						{#if key !== 'name' && !key.includes('image')}
							<span class="font-mono">{key}</span>
							{#if key === 'website' || key === 'contact:website' || key === 'contact:facebook' || key === 'contact:instagram' || key === 'contact:twitter'}
								<a href={value} target="_blank" class="text-blue-500 underline">{value}</a>
							{:else if key === 'phone' || key === 'contact:phone'}
								<a href={'tel:' + value} class="text-blue-500 underline">{value}</a>
							{:else if key === 'email' || key === 'contact:email'}
								<a href={'mailto:' + value} class="text-blue-500 underline">{value}</a>
							{:else}
								<span>{value}</span>
							{/if}
						{/if}
					{/each}
				</div>
				<Button
					class="mt-2"
					variant="outline"
					disabled={$selection.size === 0}
					on:click={() => {
						let desc = Object.entries(tags)
							.map(([key, value]) => `${key}: ${value}`)
							.join('\n');
						dbUtils.addOrUpdateWaypoint({
							attributes: {
								lat: $overpassPopupPOI.lat,
								lon: $overpassPopupPOI.lon
							},
							name: tags.name ?? '',
							desc: desc,
							cmt: desc
						});
					}}
				>
					<MapPin size="16" class="mr-1" />
					{$_('toolbar.waypoint.add')}
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
