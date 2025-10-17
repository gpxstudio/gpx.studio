<script lang="ts">
    import LayerTree from './LayerTree.svelte';
    import { Separator } from '$lib/components/ui/separator';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
    import * as Sheet from '$lib/components/ui/sheet';
    import * as Accordion from '$lib/components/ui/accordion';
    import { Label } from '$lib/components/ui/label';
    import * as Select from '$lib/components/ui/select';
    import { Slider } from '$lib/components/ui/slider';
    import {
        basemapTree,
        defaultBasemap,
        overlays,
        overlayTree,
        overpassTree,
    } from '$lib/assets/layers';
    import { getLayers, isSelected, toggle } from '$lib/components/map/layer-control/utils';
    import { i18n } from '$lib/i18n.svelte';
    import { map } from '$lib/components/map/map';
    import CustomLayers from './CustomLayers.svelte';
    import { settings } from '$lib/logic/settings';

    const {
        selectedBasemapTree,
        selectedOverlayTree,
        selectedOverpassTree,
        currentBasemap,
        currentOverlays,
        customLayers,
        opacities,
    } = settings;

    let { open = $bindable() }: { open: boolean } = $props();

    let accordionValue: string | undefined = $state(undefined);
    let selectedOverlay = $state(undefined);
    let overlayOpacity = $state(1);

    function setOpacityFromSelection() {
        if (selectedOverlay) {
            if ($opacities.hasOwnProperty(selectedOverlay)) {
                overlayOpacity = $opacities[selectedOverlay];
            } else {
                overlayOpacity = 1;
            }
        } else {
            overlayOpacity = 1;
        }
    }

    $effect(() => {
        if ($selectedBasemapTree && $currentBasemap) {
            if (!isSelected($selectedBasemapTree, $currentBasemap)) {
                if (!isSelected($selectedBasemapTree, defaultBasemap)) {
                    $selectedBasemapTree = toggle($selectedBasemapTree, defaultBasemap);
                }
                $currentBasemap = defaultBasemap;
            }
        }
    });

    $effect(() => {
        if ($selectedOverlayTree && $currentOverlays) {
            let overlayLayers = getLayers($currentOverlays);
            let toRemove = Object.entries(overlayLayers).filter(
                ([id, checked]) => checked && !isSelected($selectedOverlayTree, id)
            );
            if (toRemove.length > 0) {
                currentOverlays.update((tree) => {
                    toRemove.forEach(([id]) => {
                        toggle(tree, id);
                    });
                    return tree;
                });
            }
        }
    });
</script>

<Sheet.Root bind:open>
    <Sheet.Trigger class="hidden" />
    <Sheet.Content>
        <Sheet.Header class="h-full">
            <Sheet.Title>{i18n._('layers.settings')}</Sheet.Title>
            <ScrollArea class="w-[105%] min-h-full pr-4">
                <Sheet.Description>
                    {i18n._('layers.settings_help')}
                </Sheet.Description>
                <Accordion.Root class="flex flex-col" bind:value={accordionValue} type="single">
                    <Accordion.Item value="layer-selection" class="flex flex-col">
                        <Accordion.Trigger>{i18n._('layers.selection')}</Accordion.Trigger>
                        <Accordion.Content class="grow flex flex-col border rounded">
                            <div class="py-2 pl-1 pr-2">
                                <LayerTree
                                    layerTree={basemapTree}
                                    name="basemapSettings"
                                    multiple={true}
                                    bind:checked={$selectedBasemapTree}
                                />
                            </div>
                            <Separator />
                            <div class="py-2 pl-1 pr-2">
                                <LayerTree
                                    layerTree={overlayTree}
                                    name="overlaySettings"
                                    multiple={true}
                                    bind:checked={$selectedOverlayTree}
                                />
                            </div>
                            <Separator />
                            <div class="py-2 pl-1 pr-2">
                                <LayerTree
                                    layerTree={overpassTree}
                                    name="overpassSettings"
                                    multiple={true}
                                    bind:checked={$selectedOverpassTree}
                                />
                            </div>
                        </Accordion.Content>
                    </Accordion.Item>
                    <Accordion.Item value="overlay-opacity">
                        <Accordion.Trigger>{i18n._('layers.opacity')}</Accordion.Trigger>
                        <Accordion.Content class="flex flex-col gap-3 overflow-visible">
                            <div class="flex flex-row gap-6 items-center">
                                <Label>
                                    {i18n._('layers.custom_layers.overlay')}
                                </Label>
                                <Select.Root
                                    bind:value={selectedOverlay}
                                    type="single"
                                    onValueChange={setOpacityFromSelection}
                                >
                                    <Select.Trigger class="h-8 mr-1">
                                        {#if selectedOverlay}
                                            {#if isSelected($selectedOverlayTree, selectedOverlay)}
                                                {i18n._(`layers.label.${selectedOverlay}`)}
                                            {:else if $customLayers.hasOwnProperty(selectedOverlay)}
                                                {$customLayers[selectedOverlay].name}
                                            {/if}
                                        {/if}
                                    </Select.Trigger>
                                    <Select.Content class="h-fit max-h-[40dvh] overflow-y-auto">
                                        {#each Object.keys(overlays) as id}
                                            {#if isSelected($selectedOverlayTree, id)}
                                                <Select.Item value={id}
                                                    >{i18n._(`layers.label.${id}`)}</Select.Item
                                                >
                                            {/if}
                                        {/each}
                                        {#each Object.entries($customLayers) as [id, layer]}
                                            {#if layer.layerType === 'overlay'}
                                                <Select.Item value={id}>{layer.name}</Select.Item>
                                            {/if}
                                        {/each}
                                    </Select.Content>
                                </Select.Root>
                            </div>
                            <Label class="flex flex-row gap-6 items-center">
                                {i18n._('menu.style.opacity')}
                                <div class="p-2 pr-3 grow">
                                    <Slider
                                        bind:value={overlayOpacity}
                                        type="single"
                                        min={0.1}
                                        max={1}
                                        step={0.1}
                                        disabled={selectedOverlay === undefined}
                                        onValueChange={(value) => {
                                            if (selectedOverlay) {
                                                if (
                                                    $map &&
                                                    $currentOverlays &&
                                                    isSelected($currentOverlays, selectedOverlay)
                                                ) {
                                                    try {
                                                        $map.removeImport(selectedOverlay);
                                                    } catch (e) {
                                                        // No reliable way to check if the map is ready to remove sources and layers
                                                    }
                                                }
                                                $opacities[selectedOverlay] = value;
                                            }
                                        }}
                                    />
                                </div>
                            </Label>
                        </Accordion.Content>
                    </Accordion.Item>
                    <Accordion.Item value="custom-layers">
                        <Accordion.Trigger>{i18n._('layers.custom_layers.title')}</Accordion.Trigger
                        >
                        <Accordion.Content>
                            <ScrollArea>
                                <CustomLayers />
                            </ScrollArea>
                        </Accordion.Content>
                    </Accordion.Item>
                </Accordion.Root>
            </ScrollArea>
        </Sheet.Header>
    </Sheet.Content>
</Sheet.Root>
