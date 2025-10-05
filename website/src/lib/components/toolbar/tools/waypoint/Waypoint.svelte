<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import * as Select from '$lib/components/ui/select';
    import { i18n } from '$lib/i18n.svelte';
    import { ListWaypointItem } from '$lib/components/file-list/file-list';
    import { dbUtils, fileObservers, getFile, settings, type GPXFileWithStatistics } from '$lib/db';
    import { get } from 'svelte/store';
    import Help from '$lib/components/Help.svelte';
    import { onDestroy, onMount } from 'svelte';
    import { map } from '$lib/stores';
    import { getURLForLanguage, resetCursor, setCrosshairCursor } from '$lib/utils';
    import { MapPin, CircleX, Save } from '@lucide/svelte';
    import { getSymbolKey, symbols } from '$lib/assets/symbols';
    import { selection } from '$lib/logic/selection.svelte';
    import { selectedWaypoint } from './utils.svelte';

    let props: {
        class?: string;
    } = $props();

    let name = $state('');
    let description = $state('');
    let link = $state('');
    let symbolKey = $state('');
    let longitude = $state(0);
    let latitude = $state(0);

    let canCreate = $derived(selection.value.size > 0);

    function resetWaypointData() {
        name = '';
        description = '';
        link = '';
        symbolKey = '';
        longitude = 0;
        latitude = 0;
    }

    function createOrUpdateWaypoint() {
        if (typeof latitude === 'string') {
            latitude = parseFloat(latitude);
        }
        if (typeof longitude === 'string') {
            longitude = parseFloat(longitude);
        }
        latitude = parseFloat(latitude.toFixed(6));
        longitude = parseFloat(longitude.toFixed(6));

        dbUtils.addOrUpdateWaypoint(
            {
                attributes: {
                    lat: latitude,
                    lon: longitude,
                },
                name: name.length > 0 ? name : undefined,
                desc: description.length > 0 ? description : undefined,
                cmt: description.length > 0 ? description : undefined,
                link: link.length > 0 ? { attributes: { href: link } } : undefined,
                sym: symbols[symbolKey]?.value ?? '',
            },
            selectedWaypoint.wpt && selectedWaypoint.fileId
                ? new ListWaypointItem(selectedWaypoint.fileId, selectedWaypoint.wpt._data.index)
                : undefined
        );

        selectedWaypoint.reset();
        resetWaypointData();
    }

    function setCoordinates(e: any) {
        latitude = e.lngLat.lat.toFixed(6);
        longitude = e.lngLat.lng.toFixed(6);
    }

    let sortedSymbols = $derived(
        Object.entries(symbols).sort((a, b) => {
            return i18n
                ._(`gpx.symbol.${a[0]}`)
                .localeCompare(i18n._(`gpx.symbol.${b[0]}`), i18n.lang);
        })
    );

    onMount(() => {
        map.value?.on('click', setCoordinates);
        // setCrosshairCursor();
    });

    onDestroy(() => {
        map.value?.off('click', setCoordinates);
        // resetCursor();
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-96 {props.class ?? ''}">
    <fieldset class="flex flex-col gap-2">
        <Label for="name">{i18n._('menu.metadata.name')}</Label>
        <Input
            bind:value={name}
            id="name"
            class="font-semibold h-8"
            disabled={!canCreate && !selectedWaypoint.wpt}
        />
        <Label for="description">{i18n._('menu.metadata.description')}</Label>
        <Textarea
            bind:value={description}
            id="description"
            disabled={!canCreate && !selectedWaypoint.wpt}
        />
        <Label for="symbol">{i18n._('toolbar.waypoint.icon')}</Label>
        <Select.Root bind:value={symbolKey} type="single">
            <Select.Trigger
                id="symbol"
                class="w-full h-8"
                disabled={!canCreate && !selectedWaypoint.wpt}
            >
                {#if symbolKey in symbols}
                    {i18n._(`gpx.symbol.${symbolKey}`)}
                {:else}
                    {symbolKey}
                {/if}
            </Select.Trigger>
            <Select.Content class="max-h-60 overflow-y-scroll">
                {#each sortedSymbols as [key, symbol]}
                    <Select.Item value={symbol.value}>
                        <span>
                            {#if symbol.icon}
                                <svelte:component
                                    this={symbol.icon}
                                    size="14"
                                    class="inline-block align-sub mr-0.5"
                                />
                            {:else}
                                <span class="w-4 inline-block"></span>
                            {/if}
                            {i18n._(`gpx.symbol.${key}`)}
                        </span>
                    </Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
        <Label for="link">{i18n._('toolbar.waypoint.link')}</Label>
        <Input
            bind:value={link}
            id="link"
            class="h-8"
            disabled={!canCreate && !selectedWaypoint.wpt}
        />
        <div class="flex flex-row gap-2">
            <div class="grow">
                <Label for="latitude">{i18n._('toolbar.waypoint.latitude')}</Label>
                <Input
                    bind:value={latitude}
                    type="number"
                    id="latitude"
                    step={1e-6}
                    min={-90}
                    max={90}
                    class="text-xs h-8"
                    disabled={!canCreate && !selectedWaypoint.wpt}
                />
            </div>
            <div class="grow">
                <Label for="longitude">{i18n._('toolbar.waypoint.longitude')}</Label>
                <Input
                    bind:value={longitude}
                    type="number"
                    id="longitude"
                    step={1e-6}
                    min={-180}
                    max={180}
                    class="text-xs h-8"
                    disabled={!canCreate && !selectedWaypoint.wpt}
                />
            </div>
        </div>
    </fieldset>
    <div class="flex flex-row gap-2 items-center">
        <Button
            variant="outline"
            disabled={!canCreate && !selectedWaypoint.wpt}
            class="grow whitespace-normal h-fit"
            onclick={createOrUpdateWaypoint}
        >
            {#if selectedWaypoint.wpt}
                <Save size="16" class="mr-1 shrink-0" />
                {i18n._('menu.metadata.save')}
            {:else}
                <MapPin size="16" class="mr-1 shrink-0" />
                {i18n._('toolbar.waypoint.create')}
            {/if}
        </Button>
        <Button
            variant="outline"
            onclick={() => {
                selectedWaypoint.reset();
                resetWaypointData();
            }}
        >
            <CircleX size="16" />
        </Button>
    </div>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/poi')}>
        {#if selectedWaypoint.wpt || canCreate}
            {i18n._('toolbar.waypoint.help')}
        {:else}
            {i18n._('toolbar.waypoint.help_no_selection')}
        {/if}
    </Help>
</div>
