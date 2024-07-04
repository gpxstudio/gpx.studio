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
		RouteOff,
		Repeat,
		SquareArrowUpLeft,
		SquareArrowOutDownRight
	} from 'lucide-svelte';

	import { map, newGPXFile, routingControls, selectFileWhenLoaded } from '$lib/stores';
	import { dbUtils, getFileIds, settings } from '$lib/db';
	import { brouterProfiles, routingProfileSelectItem } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { RoutingControls } from './RoutingControls';
	import mapboxgl from 'mapbox-gl';
	import { fileObservers } from '$lib/db';
	import { slide } from 'svelte/transition';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListRootItem, type ListItem } from '$lib/components/file-list/FileList';
	import { flyAndScale } from '$lib/utils';
	import { onDestroy, onMount } from 'svelte';
	import { TrackPoint } from 'gpx';
	import { produce } from 'immer';

	export let popup: mapboxgl.Popup;
	export let popupElement: HTMLElement;
	let selectedItem: ListItem | null = null;

	const { minimizeRoutingMenu, privateRoads, routing } = settings;

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

	function createFileWithPoint(e: any) {
		if ($selection.size === 0) {
			let file = newGPXFile();
			file.replaceTrackPoints(0, 0, 0, 0, [
				new TrackPoint({
					attributes: {
						lat: e.lngLat.lat,
						lon: e.lngLat.lng
					}
				})
			]);
			file._data.id = getFileIds(1)[0];
			dbUtils.add(file);
			selectFileWhenLoaded(file._data.id);
		}
	}

	onMount(() => {
		$map?.on('click', createFileWithPoint);
	});

	onDestroy(() => {
		$map?.off('click', createFileWithPoint);
	});
</script>

{#if $minimizeRoutingMenu}
	<div class="-m-1.5 -mb-2">
		<Button variant="ghost" class="px-1 h-[26px]" on:click={() => ($minimizeRoutingMenu = false)}>
			<SquareArrowOutDownRight size="18" />
		</Button>
	</div>
{:else}
	<div class="flex flex-col gap-3 w-80" in:flyAndScale={{ x: -2, y: 0, duration: 50 }}>
		<div class="grow flex flex-col gap-3">
			<Tooltip>
				<Label slot="data" class="w-full flex flex-row justify-between items-center gap-2">
					<span class="flex flex-row gap-1">
						{#if $routing}
							<Route size="16" />
						{:else}
							<RouteOff size="16" />
						{/if}
						{$_('toolbar.routing.use_routing')}
					</span>
					<Switch class="scale-90" bind:checked={$routing} />
				</Label>
				<span slot="tooltip">{$_('toolbar.routing.use_routing_tooltip')}</span>
			</Tooltip>
			{#if $routing}
				<div class="flex flex-col gap-3" in:slide>
					<Label class="w-full flex flex-row justify-between items-center gap-2">
						<span class="shrink-0 flex flex-row items-center gap-1">
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
						</span>
						<Select.Root bind:selected={$routingProfileSelectItem}>
							<Select.Trigger class="h-8 grow">
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
					</Label>
					<Label class="w-full flex flex-row justify-between items-center gap-2">
						<span class="flex flex-row gap-1"
							><TriangleAlert size="16" />{$_('toolbar.routing.allow_private')}</span
						>
						<Switch class="scale-90" bind:checked={$privateRoads} />
					</Label>
				</div>
			{/if}
		</div>
		<div class="flex flex-row flex-wrap justify-center gap-1">
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={!validSelection}
					on:click={dbUtils.reverseSelection}
				>
					<ArrowRightLeft size="12" />{$_('toolbar.routing.reverse.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.reverse.tooltip')}</span>
			</Tooltip>
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={$selection.size != 1 || !validSelection}
					on:click={() => {
						const fileId = get(selection).getSelected()[0].getFileId();
						routingControls.get(fileId)?.routeToStart();
					}}
				>
					<Home size="12" />{$_('toolbar.routing.route_back_to_start.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.route_back_to_start.tooltip')}</span>
			</Tooltip>
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={$selection.size != 1 || !validSelection}
					on:click={() => {
						const fileId = get(selection).getSelected()[0].getFileId();
						routingControls.get(fileId)?.createRoundTrip();
					}}
				>
					<Repeat size="12" />{$_('toolbar.routing.round_trip.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.round_trip.tooltip')}</span>
			</Tooltip>
		</div>
		<div class="w-full flex flex-row gap-2 items-end justify-between">
			<Help>
				{#if $selection.size > 1}
					<div>{$_('toolbar.routing.help_multiple_files')}</div>
				{:else if $selection.size == 0 || !validSelection}
					<div>{$_('toolbar.routing.help_no_file')}</div>
				{:else}
					<div>{$_('toolbar.routing.help')}</div>
				{/if}
			</Help>
			<Button variant="ghost" class="px-1 h-6" on:click={() => ($minimizeRoutingMenu = true)}>
				<SquareArrowUpLeft size="18" />
			</Button>
		</div>
	</div>
{/if}
