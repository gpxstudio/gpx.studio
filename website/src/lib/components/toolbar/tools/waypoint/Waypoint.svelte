<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import * as Select from '$lib/components/ui/select';
    import { i18n } from '$lib/i18n.svelte';
    import Help from '$lib/components/Help.svelte';
    import { onDestroy, onMount, untrack } from 'svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { MapPin, CircleX, Save } from '@lucide/svelte';
    import { getSymbolKey, symbols } from '$lib/assets/symbols';
    import { engine } from '$lib/engine';
    import { selectionSize } from '$lib/selection-helpers';
    import { getElevation } from '$lib/utils';
    import { selectedWaypoint } from './waypoint';
    import { map } from '$lib/components/map/map';
    import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
    import maplibregl from 'maplibre-gl';
    import { getSvgForSymbol } from '$lib/components/map/gpx-layer/gpx-layer';

    let props: {
        class?: string;
    } = $props();

    let name = $state('');
    let description = $state('');
    let link = $state('');
    let sym = $state('');
    let longitude = $state(0);
    let latitude = $state(0);
    let symbolKey = $derived(getSymbolKey(sym));

    const { selection } = engine;

    let canCreate = $derived(selectionSize($selection) > 0);

    let sortedSymbols = $derived(
        Object.entries(symbols).sort((a, b) => {
            return i18n
                ._(`gpx.symbol.${a[0]}`)
                .localeCompare(i18n._(`gpx.symbol.${b[0]}`), i18n.lang);
        })
    );

    let marker: maplibregl.Marker | null = null;

    function reset() {
        if ($selectedWaypoint) {
            selectedWaypoint.reset();
        } else {
            name = '';
            description = '';
            link = '';
            sym = '';
            longitude = 0;
            latitude = 0;
        }
    }

    $effect(() => {
        if ($selectedWaypoint) {
            const wpt = $selectedWaypoint.waypoint;
            untrack(() => {
                name = wpt.name ?? '';
                description = wpt.desc ?? '';
                if (wpt.cmt !== undefined && wpt.cmt !== wpt.desc) {
                    description += '\n\n' + wpt.cmt;
                }
                link = wpt.links?.[0]?.href ?? '';
                sym = wpt.sym ?? '';
                longitude = parseFloat(wpt.lng.toFixed(6));
                latitude = parseFloat(wpt.lat.toFixed(6));
            });
        } else {
            untrack(reset);
        }
    });

    async function createOrUpdateWaypoint() {
        if (typeof latitude === 'string') {
            latitude = parseFloat(latitude);
        }
        if (typeof longitude === 'string') {
            longitude = parseFloat(longitude);
        }
        latitude = parseFloat(latitude.toFixed(6));
        longitude = parseFloat(longitude.toFixed(6));

        const target = $selectedWaypoint;
        const [ele] = await getElevation([{ lat: latitude, lng: longitude }]);
        const waypoint = {
            lng: longitude,
            lat: latitude,
            ele,
            name,
            desc: description,
            icon: sym,
            link,
        };
        if (target) {
            engine.updateWaypoint(target.fileId, target.id, waypoint);
        } else {
            // it goes in the selected files
            engine.newWaypoint(waypoint);
        }

        reset();
    }

    function setCoordinates(e: any) {
        if (
            $map?.queryRenderedFeatures(e.point, {
                layers: $map.getLayersOrder().filter((layerId) => layerId.endsWith('-waypoints')),
            }).length
        ) {
            // Clicked on a waypoint, ignoring
            return;
        }
        latitude = e.lngLat.lat.toFixed(6);
        longitude = e.lngLat.lng.toFixed(6);
    }

    $effect(() => {
        if ($selectedWaypoint) {
            if (marker) {
                marker.remove();
                marker = null;
            }
        } else if (latitude != 0 || longitude != 0) {
            if ($map) {
                if (marker) {
                    marker.setLngLat([longitude, latitude]).getElement().innerHTML =
                        getSvgForSymbol(symbolKey);
                } else {
                    let element = document.createElement('div');
                    element.classList.add('w-8', 'h-8');
                    element.innerHTML = getSvgForSymbol(symbolKey);
                    marker = new maplibregl.Marker({
                        element,
                        anchor: 'bottom',
                    })
                        .setLngLat([longitude, latitude])
                        .addTo($map);
                }
            }
        } else {
            if (marker) {
                marker.remove();
                marker = null;
            }
        }
    });

    onMount(() => {
        if ($map) {
            $map.on('click', setCoordinates);
            mapCursor.notify(MapCursorState.TOOL_WITH_CROSSHAIR, true);
        }
    });

    onDestroy(() => {
        if ($map) {
            $map.off('click', setCoordinates);
            mapCursor.notify(MapCursorState.TOOL_WITH_CROSSHAIR, false);
        }
        if (marker) {
            marker.remove();
            marker = null;
        }
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-96 {props.class ?? ''}">
    <fieldset class="flex flex-col gap-1.5">
        <div class="flex flex-col gap-1">
            <Label for="name">{i18n._('menu.metadata.name')}</Label>
            <Input
                bind:value={name}
                id="name"
                class="font-semibold"
                disabled={!canCreate && !$selectedWaypoint}
            />
        </div>
        <div class="flex flex-col gap-1">
            <Label for="description">{i18n._('menu.metadata.description')}</Label>
            <Textarea
                bind:value={description}
                id="description"
                disabled={!canCreate && !$selectedWaypoint}
                class="min-h-8 h-8 py-1 px-3 text-sm"
            />
        </div>
        <div class="flex flex-col gap-1">
            <Label for="symbol">{i18n._('toolbar.waypoint.icon')}</Label>
            <Select.Root bind:value={sym} type="single">
                <Select.Trigger
                    id="symbol"
                    class="w-full"
                    disabled={!canCreate && !$selectedWaypoint}
                >
                    <span class="flex flex-row gap-1.5 items-center">
                        {#if symbolKey}
                            {#if symbols[symbolKey].icon}
                                {@const Component = symbols[symbolKey].icon}
                                <Component size="14" />
                            {/if}
                            {i18n._(`gpx.symbol.${symbolKey}`)}
                        {:else}
                            {sym}
                        {/if}
                    </span>
                </Select.Trigger>
                <Select.Content class="max-h-60">
                    {#each sortedSymbols as [key, symbol]}
                        <Select.Item value={symbol.value}>
                            <span>
                                {#if symbol.icon}
                                    {@const Component = symbol.icon}
                                    <Component size="14" class="inline-block align-sub" />
                                {:else}
                                    <span class="w-4 inline-block"></span>
                                {/if}
                                {i18n._(`gpx.symbol.${key}`)}
                            </span>
                        </Select.Item>
                    {/each}
                </Select.Content>
            </Select.Root>
        </div>
        <div class="flex flex-col gap-1">
            <Label for="link">{i18n._('toolbar.waypoint.link')}</Label>
            <Input
                bind:value={link}
                id="link"
                class="h-8"
                disabled={!canCreate && !$selectedWaypoint}
            />
        </div>
        <div class="flex flex-row gap-1.5">
            <div class="grow flex flex-col gap-1">
                <Label for="latitude">{i18n._('toolbar.waypoint.latitude')}</Label>
                <Input
                    bind:value={latitude}
                    type="number"
                    id="latitude"
                    step={1e-6}
                    min={-90}
                    max={90}
                    class="text-xs h-8"
                    disabled={!canCreate && !$selectedWaypoint}
                />
            </div>
            <div class="grow flex flex-col gap-1">
                <Label for="longitude">{i18n._('toolbar.waypoint.longitude')}</Label>
                <Input
                    bind:value={longitude}
                    type="number"
                    id="longitude"
                    step={1e-6}
                    min={-180}
                    max={180}
                    class="text-xs h-8"
                    disabled={!canCreate && !$selectedWaypoint}
                />
            </div>
        </div>
    </fieldset>
    <div class="flex flex-row gap-1.5 items-center">
        <Button
            variant="outline"
            disabled={!canCreate && !$selectedWaypoint}
            class="grow shrink h-fit min-h-8 whitespace-normal py-1"
            onclick={createOrUpdateWaypoint}
        >
            {#if $selectedWaypoint}
                <Save size="16" class="shrink-0" />
                {i18n._('menu.metadata.save')}
            {:else}
                <MapPin size="16" class="shrink-0" />
                {i18n._('toolbar.waypoint.create')}
            {/if}
        </Button>
        <Button variant="outline" size="icon" onclick={reset}>
            <CircleX size="16" />
        </Button>
    </div>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/poi')}>
        {#if $selectedWaypoint || canCreate}
            {i18n._('toolbar.waypoint.help')}
        {:else}
            {i18n._('toolbar.waypoint.help_no_selection')}
        {/if}
    </Help>
</div>
