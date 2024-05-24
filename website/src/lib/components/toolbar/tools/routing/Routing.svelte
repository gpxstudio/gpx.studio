<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import Help from '$lib/components/Help.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		Bike,
		Footprints,
		Waves,
		TrainFront,
		Route,
		TriangleAlert,
		ArrowRightLeft,
		Home,
		RouteOff
	} from 'lucide-svelte';

	import { map, routingControls } from '$lib/stores';
	import { dbUtils, settings } from '$lib/db';
	import { brouterProfiles, routingProfileSelectItem } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { RoutingControls } from './RoutingControls';
	import mapboxgl from 'mapbox-gl';
	import { fileObservers } from '$lib/db';
	import { slide } from 'svelte/transition';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListRootItem, type ListItem } from '$lib/components/file-list/FileList';

	export let popup: mapboxgl.Popup;
	export let popupElement: HTMLElement;
	let selectedItem: ListItem | null = null;

	const { privateRoads, routing } = settings;

	$: if ($map) {
		// remove controls for deleted files
		routingControls.forEach((controls, fileId) => {
			if (!$fileObservers.has(fileId)) {
				controls.destroy();
				routingControls.delete(fileId);

				if (selectedItem && selectedItem.getFileId() === fileId) {
					selectedItem = null;
				}
			}
		});
		// add controls for new files
		$fileObservers.forEach((file, fileId) => {
			if (!routingControls.has(fileId)) {
				routingControls.set(
					fileId,
					new RoutingControls(get(map), fileId, file, popup, popupElement)
				);
			}
		});
	}

	$: validSelection = $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints']);
</script>

<div class=" flex flex-col gap-3">
	<Tooltip>
		<div slot="data" class="w-full flex flex-row justify-between items-center gap-2">
			<Label for="routing" class="flex flex-row gap-1">
				{#if $routing}
					<Route size="16" />
				{:else}
					<RouteOff size="16" />
				{/if}
				{$_('toolbar.routing.use_routing')}</Label
			>
			<Switch id="routing" class="scale-90" bind:checked={$routing} />
		</div>
		<span slot="tooltip">{$_('toolbar.routing.use_routing_tooltip')}</span>
	</Tooltip>

	{#if $routing}
		<div class="flex flex-col gap-3" in:slide>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label class="flex flex-row gap-1">
					{#if $routingProfileSelectItem.value.includes('bike') || $routingProfileSelectItem.value.includes('motorcycle')}
						<Bike size="16" />
					{:else if $routingProfileSelectItem.value.includes('foot')}
						<Footprints size="16" />
					{:else if $routingProfileSelectItem.value.includes('water')}
						<Waves size="16" />
					{:else if $routingProfileSelectItem.value.includes('railway')}
						<TrainFront size="16" />
					{/if}
					{$_('toolbar.routing.activity')}
				</Label>
				<Select.Root bind:selected={$routingProfileSelectItem}>
					<Select.Trigger class="h-8 w-full">
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						{#each Object.keys(brouterProfiles) as profile}
							<Select.Item value={profile}
								>{$_(`toolbar.routing.activities.${profile}`)}</Select.Item
							>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label for="private" class="flex flex-row gap-1"
					><TriangleAlert size="16" />{$_('toolbar.routing.allow_private')}</Label
				>
				<Switch id="private" class="scale-90" bind:checked={$privateRoads} />
			</div>
		</div>
	{/if}
	<div class="flex flex-row justify-center gap-2">
		<Tooltip>
			<Button
				slot="data"
				variant="outline"
				disabled={!validSelection}
				on:click={dbUtils.reverseSelection}
			>
				<ArrowRightLeft size="16" />
			</Button>
			<span slot="tooltip">{$_('toolbar.routing.reverse_tooltip')}</span>
		</Tooltip>
		<Tooltip>
			<Button
				slot="data"
				variant="outline"
				disabled={$selection.size != 1 || !validSelection}
				on:click={() => {
					const fileId = get(selection).getSelected()[0].getFileId();
					routingControls.get(fileId)?.routeToStart();
				}}
			>
				<Home size="16" />
			</Button>
			<span slot="tooltip">{$_('toolbar.routing.route_back_to_start_tooltip')}</span>
		</Tooltip>
		<Tooltip>
			<Button
				slot="data"
				variant="outline"
				disabled={$selection.size != 1 || !validSelection}
				on:click={() => {
					const fileId = get(selection).getSelected()[0].getFileId();
					routingControls.get(fileId)?.createRoundTrip();
				}}
			>
				<Home size="16" />
			</Button>
			<span slot="tooltip">{$_('toolbar.routing.round_trip_tooltip')}</span>
		</Tooltip>
	</div>
	<Help class="max-w-60">
		{#if $selection.size > 1}
			<div>{$_('toolbar.routing.help_multiple_files')}</div>
		{:else if $selection.size == 0 || !validSelection}
			<div>{$_('toolbar.routing.help_no_file')}</div>
		{:else}
			<div>{$_('toolbar.routing.help')}</div>
		{/if}
	</Help>
</div>
