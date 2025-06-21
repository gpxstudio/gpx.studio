<script lang="ts">
    import CustomControl from '$lib/components/map/custom-control/CustomControl.svelte';
    import LayerTree from './LayerTree.svelte';
    // import { OverpassLayer } from './OverpassLayer';
    import { Separator } from '$lib/components/ui/separator';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
    import { Layers } from '@lucide/svelte';
    import { basemaps, defaultBasemap, overlays } from '$lib/assets/layers';
    import { settings } from '$lib/logic/settings.svelte';
    import { map } from '$lib/components/map/utils.svelte';
    import { customBasemapUpdate, getLayers } from './utils.svelte';
    import type { ImportSpecification, StyleSpecification } from 'mapbox-gl';

    let container: HTMLDivElement;
    // let overpassLayer: OverpassLayer;

    const {
        currentBasemap,
        previousBasemap,
        currentOverlays,
        currentOverpassQueries,
        selectedBasemapTree,
        selectedOverlayTree,
        selectedOverpassTree,
        customLayers,
        opacities,
    } = settings;

    function setStyle() {
        if (!map.value) {
            return;
        }
        let basemap = basemaps.hasOwnProperty(currentBasemap.value)
            ? basemaps[currentBasemap.value]
            : (customLayers.value[currentBasemap.value]?.value ?? basemaps[defaultBasemap]);
        map.value.removeImport('basemap');
        if (typeof basemap === 'string') {
            map.value.addImport({ id: 'basemap', url: basemap }, 'overlays');
        } else {
            map.value.addImport(
                {
                    id: 'basemap',
                    url: '',
                    data: basemap as StyleSpecification,
                },
                'overlays'
            );
        }
    }

    $effect(() => {
        if (map.value && (currentBasemap.value || customBasemapUpdate.value)) {
            setStyle();
        }
    });

    function addOverlay(id: string) {
        if (!map.value) {
            return;
        }
        try {
            let overlay = customLayers.value.hasOwnProperty(id)
                ? customLayers.value[id].value
                : overlays[id];
            if (typeof overlay === 'string') {
                map.value.addImport({ id, url: overlay });
            } else {
                if (opacities.value.hasOwnProperty(id)) {
                    overlay = {
                        ...overlay,
                        layers: (overlay as StyleSpecification).layers.map((layer) => {
                            if (layer.type === 'raster') {
                                if (!layer.paint) {
                                    layer.paint = {};
                                }
                                layer.paint['raster-opacity'] = opacities.value[id];
                            }
                            return layer;
                        }),
                    };
                }
                map.value.addImport({
                    id,
                    url: '',
                    data: overlay as StyleSpecification,
                });
            }
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
        }
    }

    function updateOverlays() {
        if (map.value && currentOverlays.value && opacities.value) {
            let overlayLayers = getLayers(currentOverlays.value);
            try {
                let activeOverlays =
                    map.value
                        .getStyle()
                        ?.imports?.reduce(
                            (
                                acc: Record<string, ImportSpecification>,
                                imprt: ImportSpecification
                            ) => {
                                if (
                                    !['basemap', 'overlays', 'glyphs-and-sprite'].includes(imprt.id)
                                ) {
                                    acc[imprt.id] = imprt;
                                }
                                return acc;
                            },
                            {}
                        ) || {};
                let toRemove = Object.keys(activeOverlays).filter((id) => !overlayLayers[id]);
                toRemove.forEach((id) => {
                    map.value?.removeImport(id);
                });
                let toAdd = Object.entries(overlayLayers)
                    .filter(([id, selected]) => selected && !activeOverlays.hasOwnProperty(id))
                    .map(([id]) => id);
                toAdd.forEach((id) => {
                    addOverlay(id);
                });
            } catch (e) {
                // No reliable way to check if the map is ready to add sources and layers
            }
        }
    }

    $effect(() => {
        if (map.value && currentOverlays.value && opacities.value) {
            updateOverlays();
        }
    });

    // map.onLoad((map: mapboxgl.Map) => {
    //     if (overpassLayer) {
    //         overpassLayer.remove();
    //     }
    //     overpassLayer = new OverpassLayer(map);
    //     overpassLayer.add();
    //     map.on('style.import.load', updateOverlays);
    // });

    let open = $state(false);
    function openLayerControl() {
        open = true;
    }
    function closeLayerControl() {
        open = false;
    }
    let cancelEvents = $state(false);
</script>

<CustomControl class="group min-w-[29px] min-h-[29px] overflow-hidden">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={container}
        class="size-full"
        onmouseenter={openLayerControl}
        onmouseleave={closeLayerControl}
        onpointerenter={() => {
            if (!open) {
                cancelEvents = true;
                openLayerControl();
                setTimeout(() => {
                    cancelEvents = false;
                }, 500);
            }
        }}
    >
        <div
            class="flex flex-row justify-center items-center delay-100 transition-[opacity] duration-0 {open
                ? 'opacity-0 size-0 delay-0'
                : 'w-[29px] h-[29px]'}"
        >
            <Layers size="20" />
        </div>
        <div
            class="transition-[grid-template-rows grid-template-cols] grid grid-rows-[0fr] grid-cols-[0fr] duration-150 h-full {open
                ? 'grid-rows-[1fr] grid-cols-[1fr]'
                : ''} {cancelEvents ? 'pointer-events-none' : ''}"
        >
            <ScrollArea>
                <div class="h-fit">
                    <div class="p-2">
                        <LayerTree
                            layerTree={selectedBasemapTree.value}
                            name="basemaps"
                            selected={currentBasemap.value}
                            onselect={(value) => {
                                previousBasemap.value = currentBasemap.value;
                                currentBasemap.value = value;
                            }}
                        />
                    </div>
                    <Separator class="w-full" />
                    <div class="p-2">
                        {#if currentOverlays.value}
                            <LayerTree
                                layerTree={selectedOverlayTree.value}
                                name="overlays"
                                multiple={true}
                                bind:checked={currentOverlays.value}
                            />
                        {/if}
                    </div>
                    <Separator class="w-full" />
                    <div class="p-2">
                        {#if currentOverpassQueries.value}
                            <LayerTree
                                layerTree={selectedOverpassTree.value}
                                name="overpass"
                                multiple={true}
                                bind:checked={currentOverpassQueries.value}
                            />
                        {/if}
                    </div>
                </div>
            </ScrollArea>
        </div>
    </div>
</CustomControl>

<svelte:window
    on:click={(e) => {
        if (open && !cancelEvents && !container.contains(e.target)) {
            closeLayerControl();
        }
    }}
/>
