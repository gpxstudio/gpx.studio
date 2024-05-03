<script lang="ts">
	import ToolbarItemMenu from '$lib/components/toolbar/ToolbarItemMenu.svelte';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { map, selectedFiles, Tool } from '$lib/stores';
	import { brouterProfiles, privateRoads, routing, routingProfile } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { RoutingControls } from './RoutingControls';
	import RoutingControlPopup from './RoutingControlPopup.svelte';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { fileObservers } from '$lib/db';

	let routingControls: Map<string, RoutingControls> = new Map();
	let popupElement: HTMLElement;
	let popup: mapboxgl.Popup | null = null;
	let selectedId: string | null = null;
	let active = false;

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
	<div class="w-full flex flex-row justify-between items-center gap-2">
		<Label>{$_('toolbar.routing.activity')}</Label>
		<Select.Root bind:selected={$routingProfile}>
			<Select.Trigger class="h-8 w-40">
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				{#each Object.keys(brouterProfiles) as profile}
					<Select.Item value={profile}>{$_(`toolbar.routing.activities.${profile}`)}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
	<div class="w-full flex flex-row justify-between items-center gap-2">
		<Label for="routing">{$_('toolbar.routing.use_routing')}</Label>
		<Switch id="routing" class="scale-90" bind:checked={$routing} />
	</div>
	<div class="w-full flex flex-row justify-between items-center gap-2">
		<Label for="private">{$_('toolbar.routing.allow_private')}</Label>
		<Switch id="private" class="scale-90" bind:checked={$privateRoads} />
	</div>
	<Alert.Root class="max-w-64">
		<CircleHelp size="16" />
		<Alert.Description>
			{#if $selectedFiles.size > 1}
				<div>{$_('toolbar.routing.help_multiple_files')}</div>
			{:else if $selectedFiles.size == 0}
				<div>{$_('toolbar.routing.help_no_file')}</div>
			{:else}
				<div>{$_('toolbar.routing.help')}</div>
			{/if}
		</Alert.Description>
	</Alert.Root>
</ToolbarItemMenu>

<RoutingControlPopup bind:element={popupElement} />
