<script lang="ts">
	import ToolbarItemMenu from '$lib/components/toolbar/ToolbarItemMenu.svelte';
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

	import { map, selectedFiles, Tool } from '$lib/stores';
	import { dbUtils, settings } from '$lib/db';
	import { brouterProfiles, routingProfileSelectItem } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { RoutingControls } from './RoutingControls';
	import RoutingControlPopup from './RoutingControlPopup.svelte';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { fileObservers } from '$lib/db';
	import { slide } from 'svelte/transition';

	let routingControls: Map<string, RoutingControls> = new Map();
	let popupElement: HTMLElement;
	let popup: mapboxgl.Popup | null = null;
	let selectedId: string | null = null;
	let active = false;

	const { privateRoads, routing } = settings;

	$: if ($map) {
		// remove controls for deleted files
		routingControls.forEach((controls, fileId) => {
			if (!$fileObservers.has(fileId)) {
				controls.remove();
				routingControls.delete(fileId);

				if (selectedId === fileId) {
					selectedId = null;
				}
			}
		});
	}

	$: if ($map && $selectedFiles) {
		// update selected file
		if ($selectedFiles.size == 0 || $selectedFiles.size > 1 || !active) {
			if (selectedId) {
				routingControls.get(selectedId)?.remove();
			}
			selectedId = null;
		} else {
			let newSelectedId = get(selectedFiles).values().next().value;
			if (selectedId !== newSelectedId) {
				if (selectedId) {
					routingControls.get(selectedId)?.remove();
				}
				selectedId = newSelectedId;
			}
		}
	}

	$: if ($map && selectedId) {
		if (!routingControls.has(selectedId)) {
			let selectedFileObserver = get(fileObservers).get(selectedId);
			if (selectedFileObserver) {
				routingControls.set(
					selectedId,
					new RoutingControls(get(map), selectedId, selectedFileObserver, popup, popupElement)
				);
			}
		} else {
			routingControls.get(selectedId)?.add();
		}
	}

	onMount(() => {
		popup = new mapboxgl.Popup({
			closeButton: false,
			maxWidth: undefined
		});
		popup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});
</script>

<ToolbarItemMenu tool={Tool.ROUTING} bind:active>
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
				on:click={() => dbUtils.applyToSelectedFiles((file) => file.reverse())}
			>
				<ArrowRightLeft size="16" />
			</Button>
			<span slot="tooltip">{$_('toolbar.routing.reverse_tooltip')}</span>
		</Tooltip>
		<Tooltip>
			<Button
				slot="data"
				variant="outline"
				disabled={$selectedFiles.size != 1}
				on:click={() => {
					const fileId = get(selectedFiles).values().next().value;
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
				disabled={$selectedFiles.size != 1}
				on:click={() => {
					const fileId = get(selectedFiles).values().next().value;
					routingControls.get(fileId)?.createRoundTrip();
				}}
			>
				<Home size="16" />
			</Button>
			<span slot="tooltip">{$_('toolbar.routing.round_trip_tooltip')}</span>
		</Tooltip>
	</div>
	<Help class="max-w-60">
		{#if $selectedFiles.size > 1}
			<div>{$_('toolbar.routing.help_multiple_files')}</div>
		{:else if $selectedFiles.size == 0}
			<div>{$_('toolbar.routing.help_no_file')}</div>
		{:else}
			<div>{$_('toolbar.routing.help')}</div>
		{/if}
	</Help>
</ToolbarItemMenu>

<RoutingControlPopup bind:element={popupElement} />
