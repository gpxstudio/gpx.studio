<script lang="ts">
	import LayerTree from './LayerTree.svelte';

	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';

	import { basemapTree, overlays, overlayTree } from '$lib/assets/layers';
	import { isSelected } from '$lib/components/layer-control/utils';
	import { settings } from '$lib/db';

	import { _ } from 'svelte-i18n';
	import { writable, get } from 'svelte/store';
	import { map, setStravaHeatmapURLs } from '$lib/stores';
	import { browser } from '$app/environment';
	import CustomLayers from './CustomLayers.svelte';

	const {
		selectedBasemapTree,
		selectedOverlayTree,
		stravaHeatmapColor,
		currentOverlays,
		customLayers,
		opacities
	} = settings;

	export let open: boolean;

	let selectedOverlay = writable(undefined);
	let overlayOpacity = writable([1]);

	function setOpacityFromSelection() {
		if ($selectedOverlay) {
			let overlayId = $selectedOverlay.value;
			if ($opacities.hasOwnProperty(overlayId)) {
				$overlayOpacity = [$opacities[overlayId]];
			} else {
				$overlayOpacity = [1];
			}
		} else {
			$overlayOpacity = [1];
		}
	}

	$: if ($selectedOverlay) {
		setOpacityFromSelection();
	}

	const heatmapColors = [
		{ value: '', label: '' },
		{ value: 'blue', label: $_('layers.color.blue') },
		{ value: 'bluered', label: $_('layers.color.bluered') },
		{ value: 'gray', label: $_('layers.color.gray') },
		{ value: 'hot', label: $_('layers.color.hot') },
		{ value: 'orange', label: $_('layers.color.orange') },
		{ value: 'purple', label: $_('layers.color.purple') }
	];

	let selectedHeatmapColor = writable(heatmapColors[0]);

	$: if ($selectedHeatmapColor !== heatmapColors[0]) {
		stravaHeatmapColor.set($selectedHeatmapColor.value);

		// remove and add the heatmap layers
		let m = get(map);
		if (m) {
			let currentStravaLayers = [];
			if (overlayTree.overlays.world.strava) {
				for (let layer of Object.keys(overlayTree.overlays.world.strava)) {
					if (m.getLayer(layer)) {
						m.removeLayer(layer);
						currentStravaLayers.push(layer);
					}
					if (m.getSource(layer)) {
						m.removeSource(layer);
					}
				}
			}
			if (currentStravaLayers.length > 0) {
				currentOverlays.update(($currentOverlays) => {
					for (let layer of currentStravaLayers) {
						$currentOverlays.overlays.world.strava[layer] = false;
					}
					return $currentOverlays;
				});
				currentOverlays.update(($currentOverlays) => {
					for (let layer of currentStravaLayers) {
						$currentOverlays.overlays.world.strava[layer] = true;
					}
					return $currentOverlays;
				});
			}
		}
	}

	$: if ($stravaHeatmapColor && browser) {
		setStravaHeatmapURLs();
		if ($stravaHeatmapColor !== get(selectedHeatmapColor).value) {
			let toSelect = heatmapColors.find(({ value }) => value === $stravaHeatmapColor);
			if (toSelect) {
				selectedHeatmapColor.set(toSelect);
			}
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger class="hidden" />
	<Sheet.Content>
		<Sheet.Header class="h-full">
			<Sheet.Title>{$_('layers.settings')}</Sheet.Title>
			<Sheet.Description>
				{$_('layers.settings_help')}
			</Sheet.Description>
			<Accordion.Root class="flex flex-col overflow-hidden">
				<Accordion.Item value="item-1" class="flex flex-col overflow-hidden">
					<Accordion.Trigger>{$_('layers.selection')}</Accordion.Trigger>
					<Accordion.Content class="grow flex flex-col border rounded">
						<ScrollArea class="py-2 pr-2">
							<LayerTree
								layerTree={basemapTree}
								name="basemapSettings"
								multiple={true}
								bind:checked={$selectedBasemapTree}
							/>
						</ScrollArea>
						<Separator />
						<ScrollArea class="py-2 pr-2">
							<LayerTree
								layerTree={overlayTree}
								name="overlaySettings"
								multiple={true}
								bind:checked={$selectedOverlayTree}
							/>
						</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>{$_('layers.custom_layers.title')}</Accordion.Trigger>
					<Accordion.Content>
						<ScrollArea>
							<CustomLayers />
						</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>{$_('layers.opacity')}</Accordion.Trigger>
					<Accordion.Content class="flex flex-col gap-3 overflow-visible">
						<Label class="flex flex-row gap-2 items-center">
							{$_('layers.custom_layers.overlay')}
							<Select.Root bind:selected={$selectedOverlay}>
								<Select.Trigger class="h-8 mr-1">
									<Select.Value />
								</Select.Trigger>
								<Select.Content>
									{#each Object.keys(overlays) as id}
										{#if isSelected($selectedOverlayTree, id)}
											<Select.Item value={id}>{$_(`layers.label.${id}`)}</Select.Item>
										{/if}
									{/each}
									{#each Object.entries($customLayers) as [id, layer]}
										{#if layer.layerType === 'overlay'}
											<Select.Item value={id}>{layer.name}</Select.Item>
										{/if}
									{/each}
								</Select.Content>
							</Select.Root>
						</Label>
						<Label class="flex flex-row gap-2 items-center">
							{$_('menu.style.opacity')}
							<div class="p-2 pr-3 grow">
								<Slider
									bind:value={$overlayOpacity}
									min={0.1}
									max={1}
									step={0.1}
									disabled={$selectedOverlay === undefined}
									onValueChange={() => {
										if ($selectedOverlay) {
											$opacities[$selectedOverlay.value] = $overlayOpacity[0];
											if ($map) {
												if ($map.getLayer($selectedOverlay.value)) {
													$map.removeLayer($selectedOverlay.value);
													$currentOverlays = $currentOverlays;
												}
											}
										}
									}}
								/>
							</div>
						</Label>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-4">
					<Accordion.Trigger>{$_('layers.heatmap')}</Accordion.Trigger>
					<Accordion.Content class="overflow-visible">
						<Label class="flex flex-row items-center justify-between gap-4"
							>{$_('menu.style.color')}
							<Select.Root bind:selected={$selectedHeatmapColor}>
								<Select.Trigger class="h-8 mr-1">
									<Select.Value />
								</Select.Trigger>
								<Select.Content>
									{#each heatmapColors as { value, label }}
										<Select.Item {value}>{label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</Label>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-5">
					<Accordion.Trigger>{$_('layers.pois')}</Accordion.Trigger>
					<Accordion.Content></Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</Sheet.Header>
	</Sheet.Content>
</Sheet.Root>
