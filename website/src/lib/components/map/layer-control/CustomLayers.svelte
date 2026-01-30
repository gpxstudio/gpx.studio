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
        Layers2,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { defaultBasemap, type CustomLayer } from '$lib/assets/layers';
    import { onMount } from 'svelte';
    import { customBasemapUpdate, isSelected, remove } from './utils';
    import { settings } from '$lib/logic/settings';
    import { map } from '$lib/components/map/map';
    import { dndzone } from 'svelte-dnd-action';

    const {
        customLayers,
        selectedBasemapTree,
        selectedOverlayTree,
        currentBasemap,
        previousBasemap,
        currentOverlays,
        previousOverlays,
        customBasemapOrder,
        customOverlayOrder,
    } = settings;

    let name: string = $state('');
    let tileUrls: string[] = $state(['']);
    let maxZoom: number = $state(20);
    let layerType: 'basemap' | 'overlay' = $state('basemap');
    let resourceType: 'raster' | 'vector' = $derived.by(() => {
        if (tileUrls[0].length > 0 && tileUrls[0].includes('.json')) {
            return 'vector';
        }
        return 'raster';
    });

    let selectedLayerId: string | undefined = $state(undefined);

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
    });

    let customBasemapItems: {
        id: string;
        name: string;
    }[] = $derived(
        $customBasemapOrder.map((id) => ({
            id: id,
            name: $customLayers[id].name,
        }))
    );
    let customOverlayItems: {
        id: string;
        name: string;
    }[] = $derived(
        $customOverlayOrder.map((id) => ({
            id: id,
            name: $customLayers[id].name,
        }))
    );

    $effect(() => {
        setDataFromSelectedLayer(selectedLayerId);
    });

    function createLayer() {
        if (selectedLayerId && $customLayers[selectedLayerId].layerType !== layerType) {
            deleteLayer(selectedLayerId);
        }

        if (typeof maxZoom === 'string') {
            maxZoom = parseInt(maxZoom);
        }
        let is512 = tileUrls.some((url) => url.includes('512'));

        let layerId = selectedLayerId ?? getLayerId();
        let layer: CustomLayer = {
            id: layerId,
            name: name,
            tileUrls: tileUrls.map((url) => decodeURI(url.trim())),
            maxZoom: maxZoom,
            layerType: layerType,
            resourceType: resourceType,
            value: '',
        };

        if (resourceType === 'vector') {
            layer.value = layer.tileUrls[0];
        } else {
            layer.value = {
                version: 8,
                sources: {
                    [layerId]: {
                        type: 'raster',
                        tiles: layer.tileUrls,
                        tileSize: is512 ? 512 : 256,
                        maxzoom: maxZoom,
                    },
                },
                layers: [
                    {
                        id: layerId,
                        type: 'raster',
                        source: layerId,
                    },
                ],
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

            if ($map && $currentOverlays && isSelected($currentOverlays, layerId)) {
                try {
                    $map.removeImport(layerId);
                } catch (e) {
                    // No reliable way to check if the map is ready to remove sources and layers
                }
            }

            currentOverlays.update(($overlays) => {
                if (!$overlays.overlays.hasOwnProperty('custom')) {
                    $overlays.overlays['custom'] = {};
                }
                $overlays.overlays['custom'][layerId] = true;
                return $overlays;
            });

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

            $selectedBasemapTree = remove($selectedBasemapTree, layerId);
            $customBasemapOrder = $customBasemapOrder.filter((id) => id !== layerId);
        } else {
            if ($currentOverlays) {
                $currentOverlays = remove($currentOverlays, layerId);
            }
            $previousOverlays = remove($previousOverlays, layerId);
            $selectedOverlayTree = remove($selectedOverlayTree, layerId);
            $customOverlayOrder = $customOverlayOrder.filter((id) => id !== layerId);
        }
        $customLayers = tryDeleteLayer($customLayers, layerId);
    }

    function setDataFromSelectedLayer(layerId?: string) {
        if (layerId) {
            const layer = $customLayers[layerId];
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
</script>

<div class="flex flex-col">
    {#if $customBasemapOrder.length > 0}
        <div class="flex flex-row items-center gap-1 font-semibold mb-2">
            <Map size="16" />
            {i18n._('layers.label.basemaps')}
            <div class="grow">
                <Separator />
            </div>
        </div>
    {/if}
    <div
        class="ml-1.5 flex flex-col gap-1 {$customBasemapOrder.length > 0 ? 'mb-2' : ''}"
        use:dndzone={{
            items: customBasemapItems,
            type: 'basemap',
            dropTargetStyle: {},
            transformDraggedElement: (element) => {
                if (element) {
                    element.style.opacity = '0.5';
                }
            },
        }}
        onconsider={(e) => {
            customBasemapItems = e.detail.items;
        }}
        onfinalize={(e) => {
            customBasemapItems = e.detail.items;
            $customBasemapOrder = customBasemapItems.map((item) => item.id);
            $selectedBasemapTree.basemaps['custom'] = customBasemapItems.reduce((acc, item) => {
                acc[item.id] = true;
                return acc;
            }, {});
        }}
    >
        {#each customBasemapItems as item (item.id)}
            <div class="flex flex-row items-center gap-2">
                <Move size="12" />
                <span class="grow">{item.name}</span>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => (selectedLayerId = item.id)}
                    class="p-1 h-7"
                >
                    <Pencil size="16" />
                </Button>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => deleteLayer(item.id)}
                    class="p-1 h-7"
                >
                    <Trash2 size="16" />
                </Button>
            </div>
        {/each}
    </div>
    {#if $customOverlayOrder.length > 0}
        <div class="flex flex-row items-center gap-1 font-semibold mb-2">
            <Layers2 size="16" />
            {i18n._('layers.label.overlays')}
            <div class="grow">
                <Separator />
            </div>
        </div>
    {/if}
    <div
        class="ml-1.5 flex flex-col gap-1 {$customOverlayOrder.length > 0 ? 'mb-2' : ''}"
        use:dndzone={{
            items: customOverlayItems,
            type: 'overlay',
            dropTargetStyle: {},
            transformDraggedElement: (element) => {
                if (element) {
                    element.style.opacity = '0.5';
                }
            },
        }}
        onconsider={(e) => {
            customOverlayItems = e.detail.items;
        }}
        onfinalize={(e) => {
            customOverlayItems = e.detail.items;
            $customOverlayOrder = customOverlayItems.map((item) => item.id);
            $selectedOverlayTree.overlays['custom'] = customOverlayItems.reduce((acc, item) => {
                acc[item.id] = true;
                return acc;
            }, {});
        }}
    >
        {#each customOverlayItems as item (item.id)}
            <div class="flex flex-row items-center gap-2">
                <Move size="12" />
                <span class="grow">{item.name}</span>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => (selectedLayerId = item.id)}
                    class="p-1 h-7"
                >
                    <Pencil size="16" />
                </Button>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onclick={() => deleteLayer(item.id)}
                    class="p-1 h-7"
                >
                    <Trash2 size="16" />
                </Button>
            </div>
        {/each}
    </div>
    <Card.Root class="py-0 gap-0 shadow-none">
        <Card.Header class="p-3">
            <Card.Title class="text-base">
                {#if selectedLayerId}
                    {i18n._('layers.custom_layers.edit')}
                {:else}
                    {i18n._('layers.custom_layers.new')}
                {/if}
            </Card.Title>
        </Card.Header>
        <Card.Content class="p-3 pt-0">
            <fieldset class="flex flex-col gap-2">
                <Label for="name">{i18n._('menu.metadata.name')}</Label>
                <Input bind:value={name} id="name" class="h-8" />
                <Label for="url">{i18n._('layers.custom_layers.urls')}</Label>
                {#each tileUrls as url, i}
                    <div class="flex flex-row gap-2">
                        <Input
                            bind:value={tileUrls[i]}
                            id="url"
                            class="h-8"
                            placeholder={i18n._('layers.custom_layers.url_placeholder')}
                        />
                        {#if tileUrls.length > 1}
                            <Button
                                onclick={() =>
                                    (tileUrls = tileUrls.filter((_, index) => index !== i))}
                                variant="outline"
                                class="p-1 h-8"
                            >
                                <Minus size="16" />
                            </Button>
                        {/if}
                        {#if i === tileUrls.length - 1}
                            <Button
                                onclick={() => (tileUrls = [...tileUrls, ''])}
                                variant="outline"
                                class="p-1 h-8"
                            >
                                <Plus size="16" />
                            </Button>
                        {/if}
                    </div>
                {/each}
                {#if resourceType === 'raster'}
                    <Label for="maxZoom">{i18n._('layers.custom_layers.max_zoom')}</Label>
                    <Input
                        type="number"
                        bind:value={maxZoom}
                        id="maxZoom"
                        min={0}
                        max={22}
                        class="h-8"
                    />
                {/if}
                <Label>{i18n._('layers.custom_layers.layer_type')}</Label>
                <RadioGroup.Root bind:value={layerType} class="flex flex-row">
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="basemap" id="basemap" />
                        <Label for="basemap">{i18n._('layers.custom_layers.basemap')}</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="overlay" id="overlay" />
                        <Label for="overlay">{i18n._('layers.custom_layers.overlay')}</Label>
                    </div>
                </RadioGroup.Root>
                {#if selectedLayerId}
                    <div class="mt-2 flex flex-row gap-2">
                        <Button variant="outline" onclick={createLayer} class="grow">
                            <Save size="16" />
                            {i18n._('layers.custom_layers.update')}
                        </Button>
                        <Button variant="outline" onclick={() => (selectedLayerId = undefined)}>
                            <CircleX size="16" />
                        </Button>
                    </div>
                {:else}
                    <Button variant="outline" class="mt-2" onclick={createLayer}>
                        <CirclePlus size="16" />
                        {i18n._('layers.custom_layers.create')}
                    </Button>
                {/if}
            </fieldset>
        </Card.Content>
    </Card.Root>
</div>
