<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Button } from '$lib/components/ui/button';
    import { Separator } from '$lib/components/ui/separator';
    import * as RadioGroup from '$lib/components/ui/radio-group';
    import {
        CirclePlus,
        CircleX,
        Minus,
        Pencil,
        Plus,
        Save,
        Trash2,
        Move,
        Map,
        Layers2
    } from 'lucide-svelte';
    import { _ } from 'svelte-i18n';
    import { settings } from '$lib/db';
    import { defaultBasemap, type CustomLayer } from '$lib/assets/layers';
    import { map } from '$lib/stores';
    import { onDestroy, onMount } from 'svelte';
    import Sortable from 'sortablejs/Sortable';
    import { customBasemapUpdate } from './utils';

    const {
        customLayers,
        selectedBasemapTree,
        selectedOverlayTree,
        currentBasemap,
        previousBasemap,
        currentOverlays,
        previousOverlays,
        customBasemapOrder,
        customOverlayOrder
    } = settings;

    let name: string = '';
    let tileUrls: string[] = [''];
    let maxZoom: number = 20;
    let layerType: 'basemap' | 'overlay' = 'basemap';
    let resourceType: 'raster' | 'vector' = 'raster';

    let basemapContainer: HTMLElement;
    let overlayContainer: HTMLElement;

    let basemapSortable: Sortable;
    let overlaySortable: Sortable;

    onMount(() => {
        if ($customBasemapOrder.length === 0) {
            $customBasemapOrder = Object.keys($customLayers).filter(
                (id) => $customLayers[id].layerType === 'basemap'
            );
        }
        if ($customOverlayOrder.length === 0) {
            $customOverlayOrder = Object.keys($customLayers).filter(
                (id) => $customLayers[id].layerType === 'overlay'
            );
        }

        basemapSortable = Sortable.create(basemapContainer, {
            onSort: (e) => {
                $customBasemapOrder = basemapSortable.toArray();
                $selectedBasemapTree.basemaps['custom'] = $customBasemapOrder.reduce((acc, id) => {
                    acc[id] = true;
                    return acc;
                }, {});
            }
        });
        overlaySortable = Sortable.create(overlayContainer, {
            onSort: (e) => {
                $customOverlayOrder = overlaySortable.toArray();
                $selectedOverlayTree.overlays['custom'] = $customOverlayOrder.reduce((acc, id) => {
                    acc[id] = true;
                    return acc;
                }, {});
            }
        });

        basemapSortable.sort($customBasemapOrder);
        overlaySortable.sort($customOverlayOrder);
    });

    onDestroy(() => {
        basemapSortable.destroy();
        overlaySortable.destroy();
    });

    $: if (tileUrls[0].length > 0) {
        if (
            tileUrls[0].includes('.json') ||
            (tileUrls[0].includes('api.mapbox.com/styles') && !tileUrls[0].includes('tiles'))
        ) {
            resourceType = 'vector';
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
            layer.value = {
                version: 8,
                sources: {
                    [layerId]: {
                        type: 'raster',
                        tiles: tileUrls,
                        tileSize: 256,
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
            };
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

            if ($currentBasemap === layerId) {
                $customBasemapUpdate++;
            } else {
                $currentBasemap = layerId;
            }

            if (!$customBasemapOrder.includes(layerId)) {
                $customBasemapOrder = [...$customBasemapOrder, layerId];
            }
        } else {
            selectedOverlayTree.update(($tree) => {
                if (!$tree.overlays.hasOwnProperty('custom')) {
                    $tree.overlays['custom'] = {};
                }
                $tree.overlays['custom'][layerId] = true;
                return $tree;
            });

            if ($map) {
                try {
                    $map.removeImport(layerId);
                } catch (e) {
                    // No reliable way to check if the map is ready to remove sources and layers
                }
            }

            if (!$currentOverlays.overlays.hasOwnProperty('custom')) {
                $currentOverlays.overlays['custom'] = {};
            }
            $currentOverlays.overlays['custom'][layerId] = true;

            if (!$customOverlayOrder.includes(layerId)) {
                $customOverlayOrder = [...$customOverlayOrder, layerId];
            }
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
                $selectedBasemapTree.basemaps = tryDeleteLayer(
                    $selectedBasemapTree.basemaps,
                    'custom'
                );
            }
            $customBasemapOrder = $customBasemapOrder.filter((id) => id !== layerId);
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
                $selectedOverlayTree.overlays = tryDeleteLayer(
                    $selectedOverlayTree.overlays,
                    'custom'
                );
            }
            $customOverlayOrder = $customOverlayOrder.filter((id) => id !== layerId);

            if ($map) {
                try {
                    $map.removeImport(layerId);
                } catch (e) {
                    // No reliable way to check if the map is ready to remove sources and layers
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

<div class="flex flex-col">
    {#if $customBasemapOrder.length > 0}
        <div class="flex flex-row items-center gap-1 font-semibold mb-2">
            <Map size="16" />
            {$_('layers.label.basemaps')}
            <div class="grow">
                <Separator />
            </div>
        </div>
    {/if}
    <div
        bind:this={basemapContainer}
        class="ml-1.5 flex flex-col gap-1 {$customBasemapOrder.length > 0 ? 'mb-2' : ''}"
    >
        {#each $customBasemapOrder as id (id)}
            <div class="flex flex-row items-center gap-2" data-id={id}>
                <Move size="12" />
                <span class="grow">{$customLayers[id].name}</span>
                <Button variant="outline" on:click={() => (selectedLayerId = id)} class="p-1 h-7">
                    <Pencil size="16" />
                </Button>
                <Button variant="outline" on:click={() => deleteLayer(id)} class="p-1 h-7">
                    <Trash2 size="16" />
                </Button>
            </div>
        {/each}
    </div>
    {#if $customOverlayOrder.length > 0}
        <div class="flex flex-row items-center gap-1 font-semibold mb-2">
            <Layers2 size="16" />
            {$_('layers.label.overlays')}
            <div class="grow">
                <Separator />
            </div>
        </div>
    {/if}
    <div
        bind:this={overlayContainer}
        class="ml-1.5 flex flex-col gap-1 {$customOverlayOrder.length > 0 ? 'mb-2' : ''}"
    >
        {#each $customOverlayOrder as id (id)}
            <div class="flex flex-row items-center gap-2" data-id={id}>
                <Move size="12" />
                <span class="grow">{$customLayers[id].name}</span>
                <Button variant="outline" on:click={() => (selectedLayerId = id)} class="p-1 h-7">
                    <Pencil size="16" />
                </Button>
                <Button variant="outline" on:click={() => deleteLayer(id)} class="p-1 h-7">
                    <Trash2 size="16" />
                </Button>
            </div>
        {/each}
    </div>

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
                                on:click={() =>
                                    (tileUrls = tileUrls.filter((_, index) => index !== i))}
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
                    <Input
                        type="number"
                        bind:value={maxZoom}
                        id="maxZoom"
                        min={0}
                        max={22}
                        class="h-8"
                    />
                {/if}
                <Label>{$_('layers.custom_layers.layer_type')}</Label>
                <RadioGroup.Root bind:value={layerType} class="flex flex-row">
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="basemap" id="basemap" />
                        <Label for="basemap">{$_('layers.custom_layers.basemap')}</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="overlay" id="overlay" />
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
</div>
