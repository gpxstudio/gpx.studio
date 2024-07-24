<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { CirclePlus, CircleX, Minus, Pencil, Plus, Save, Trash2 } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { settings } from '$lib/db';
	import { defaultBasemap, extendBasemap, type CustomLayer } from '$lib/assets/layers';
	import { map } from '$lib/stores';

	const {
		customLayers,
		selectedBasemapTree,
		selectedOverlayTree,
		currentBasemap,
		previousBasemap,
		currentOverlays,
		previousOverlays
	} = settings;

	let name: string = '';
	let tileUrls: string[] = [''];
	let maxZoom: number = 20;
	let layerType: 'basemap' | 'overlay' = 'basemap';
	let resourceType: 'raster' | 'vector' = 'raster';

	$: if (tileUrls[0].length > 0) {
		if (
			tileUrls[0].includes('.json') ||
			(tileUrls[0].includes('api.mapbox.com/styles') && !tileUrls[0].includes('tiles'))
		) {
			resourceType = 'vector';
			layerType = 'basemap';
		} else {
			resourceType = 'raster';
		}
	}

	function createLayer() {
		if (selectedLayerId && $customLayers[selectedLayerId].layerType !== layerType) {
			deleteLayer(selectedLayerId);
		}

		if (typeof maxZoom === 'string') {
			maxZoom = parseInt(maxZoom);
		}

		let layerId = selectedLayerId ?? getLayerId();
		let layer: CustomLayer = {
			id: layerId,
			name: name,
			tileUrls: tileUrls,
			maxZoom: maxZoom,
			layerType: layerType,
			resourceType: resourceType,
			value: ''
		};

		if (resourceType === 'vector') {
			layer.value = tileUrls[0];
		} else {
			if (layerType === 'basemap') {
				layer.value = extendBasemap({
					version: 8,
					sources: {
						[layerId]: {
							type: 'raster',
							tiles: tileUrls,
							maxzoom: maxZoom
						}
					},
					layers: [
						{
							id: layerId,
							type: 'raster',
							source: layerId
						}
					]
				});
			} else {
				layer.value = {
					type: 'raster',
					tiles: tileUrls,
					maxzoom: maxZoom
				};
			}
		}
		$customLayers[layerId] = layer;
		addLayer(layerId);
		selectedLayerId = undefined;
		setDataFromSelectedLayer();
	}

	function getLayerId() {
		for (let id = 0; ; id++) {
			if (!$customLayers.hasOwnProperty(`custom-${id}`)) {
				return `custom-${id}`;
			}
		}
	}

	function addLayer(layerId: string) {
		if (layerType === 'basemap') {
			selectedBasemapTree.update(($tree) => {
				if (!$tree.basemaps.hasOwnProperty('custom')) {
					$tree.basemaps['custom'] = {};
				}
				$tree.basemaps['custom'][layerId] = true;
				return $tree;
			});

			$currentBasemap = layerId;
		} else {
			selectedOverlayTree.update(($tree) => {
				if (!$tree.overlays.hasOwnProperty('custom')) {
					$tree.overlays['custom'] = {};
				}
				$tree.overlays['custom'][layerId] = true;
				return $tree;
			});

			if ($map && $map.getSource(layerId)) {
				// Reset source when updating an existing layer
				if ($map.getLayer(layerId)) {
					$map.removeLayer(layerId);
				}
				$map.removeSource(layerId);
			}

			$currentOverlays.overlays['custom'][layerId] = true;
		}
	}

	function tryDeleteLayer(node: any, id: string): any {
		if (node.hasOwnProperty(id)) {
			delete node[id];
		}
		return node;
	}

	function deleteLayer(layerId: string) {
		let layer = $customLayers[layerId];
		if (layer.layerType === 'basemap') {
			if (layerId === $currentBasemap) {
				$currentBasemap = defaultBasemap;
			}
			if (layerId === $previousBasemap) {
				$previousBasemap = defaultBasemap;
			}

			$selectedBasemapTree.basemaps['custom'] = tryDeleteLayer(
				$selectedBasemapTree.basemaps['custom'],
				layerId
			);
			if (Object.keys($selectedBasemapTree.basemaps['custom']).length === 0) {
				$selectedBasemapTree.basemaps = tryDeleteLayer($selectedBasemapTree.basemaps, 'custom');
			}
		} else {
			$currentOverlays.overlays['custom'][layerId] = false;
			if ($previousOverlays.overlays['custom']) {
				$previousOverlays.overlays['custom'] = tryDeleteLayer(
					$previousOverlays.overlays['custom'],
					layerId
				);
			}

			$selectedOverlayTree.overlays['custom'] = tryDeleteLayer(
				$selectedOverlayTree.overlays['custom'],
				layerId
			);
			if (Object.keys($selectedOverlayTree.overlays['custom']).length === 0) {
				$selectedOverlayTree.overlays = tryDeleteLayer($selectedOverlayTree.overlays, 'custom');
			}

			if ($map) {
				if ($map.getLayer(layerId)) {
					$map.removeLayer(layerId);
				}
				if ($map.getSource(layerId)) {
					$map.removeSource(layerId);
				}
			}
		}
		$customLayers = tryDeleteLayer($customLayers, layerId);
	}

	let selectedLayerId: string | undefined = undefined;

	function setDataFromSelectedLayer() {
		if (selectedLayerId) {
			const layer = $customLayers[selectedLayerId];
			name = layer.name;
			tileUrls = layer.tileUrls;
			maxZoom = layer.maxZoom;
			layerType = layer.layerType;
			resourceType = layer.resourceType;
		} else {
			name = '';
			tileUrls = [''];
			maxZoom = 20;
			layerType = 'basemap';
			resourceType = 'raster';
		}
	}

	$: selectedLayerId, setDataFromSelectedLayer();
</script>

{#if Object.keys($customLayers).length > 0}
	<div class="flex flex-col gap-1 mb-3">
		{#each Object.entries($customLayers) as [id, layer] (id)}
			<div class="flex flex-row items-center gap-2">
				<span class="grow">{layer.name}</span>
				<Button variant="outline" on:click={() => (selectedLayerId = id)} class="p-1 h-8">
					<Pencil size="16" />
				</Button>
				<Button variant="outline" on:click={() => deleteLayer(id)} class="p-1 h-8">
					<Trash2 size="16" />
				</Button>
			</div>
		{/each}
	</div>
{/if}

<Card.Root>
	<Card.Header class="p-3">
		<Card.Title class="text-base">
			{#if selectedLayerId}
				{$_('layers.custom_layers.edit')}
			{:else}
				{$_('layers.custom_layers.new')}
			{/if}
		</Card.Title>
	</Card.Header>
	<Card.Content class="p-3 pt-0">
		<fieldset class="flex flex-col gap-2">
			<Label for="name">{$_('menu.metadata.name')}</Label>
			<Input bind:value={name} id="name" class="h-8" />
			<Label for="url">{$_('layers.custom_layers.urls')}</Label>
			{#each tileUrls as url, i}
				<div class="flex flex-row gap-2">
					<Input
						bind:value={tileUrls[i]}
						id="url"
						class="h-8"
						placeholder={$_('layers.custom_layers.url_placeholder')}
					/>
					{#if tileUrls.length > 1}
						<Button
							on:click={() => (tileUrls = tileUrls.filter((_, index) => index !== i))}
							variant="outline"
							class="p-1 h-8"
						>
							<Minus size="16" />
						</Button>
					{/if}
					{#if i === tileUrls.length - 1}
						<Button
							on:click={() => (tileUrls = [...tileUrls, ''])}
							variant="outline"
							class="p-1 h-8"
						>
							<Plus size="16" />
						</Button>
					{/if}
				</div>
			{/each}
			{#if resourceType === 'raster'}
				<Label for="maxZoom">{$_('layers.custom_layers.max_zoom')}</Label>
				<Input type="number" bind:value={maxZoom} id="maxZoom" min={0} max={22} class="h-8" />
			{/if}
			<Label>{$_('layers.custom_layers.layer_type')}</Label>
			<RadioGroup.Root bind:value={layerType} class="flex flex-row">
				<div class="flex items-center space-x-2">
					<RadioGroup.Item value="basemap" id="basemap" />
					<Label for="basemap">{$_('layers.custom_layers.basemap')}</Label>
				</div>
				<div class="flex items-center space-x-2">
					<RadioGroup.Item value="overlay" id="overlay" disabled={resourceType === 'vector'} />
					<Label for="overlay">{$_('layers.custom_layers.overlay')}</Label>
				</div>
			</RadioGroup.Root>
			{#if selectedLayerId}
				<div class="mt-2 flex flex-row gap-2">
					<Button variant="outline" on:click={createLayer} class="grow">
						<Save size="16" class="mr-1" />
						{$_('layers.custom_layers.update')}
					</Button>
					<Button variant="outline" on:click={() => (selectedLayerId = undefined)}>
						<CircleX size="16" />
					</Button>
				</div>
			{:else}
				<Button variant="outline" class="mt-2" on:click={createLayer}>
					<CirclePlus size="16" class="mr-1" />
					{$_('layers.custom_layers.create')}
				</Button>
			{/if}
		</fieldset>
	</Card.Content>
</Card.Root>
