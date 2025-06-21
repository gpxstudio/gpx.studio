<script lang="ts" context="module">
    import { writable } from 'svelte/store';

    export const selectedWaypoint = writable<[Waypoint, string] | undefined>(undefined);
</script>

<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import * as Select from '$lib/components/ui/select';
    import { selection } from '$lib/components/file-list/Selection';
    import { Waypoint } from 'gpx';
    import { i18n } from '$lib/i18n.svelte';
    import { ListWaypointItem } from '$lib/components/file-list/FileList';
    import { dbUtils, fileObservers, getFile, settings, type GPXFileWithStatistics } from '$lib/db';
    import { get } from 'svelte/store';
    import Help from '$lib/components/Help.svelte';
    import { onDestroy, onMount } from 'svelte';
    import { map } from '$lib/stores';
    import { getURLForLanguage, resetCursor, setCrosshairCursor } from '$lib/utils';
    import { MapPin, CircleX, Save } from '@lucide/svelte';
    import { getSymbolKey, symbols } from '$lib/assets/symbols';

    let name: string;
    let description: string;
    let link: string;
    let longitude: number;
    let latitude: number;
    let symbolKey: string;

    const { treeFileView } = settings;

    $: canCreate = $selection.size > 0;

    $: if ($treeFileView && $selection) {
        selectedWaypoint.update(() => {
            if ($selection.size === 1) {
                let item = $selection.getSelected()[0];
                if (item instanceof ListWaypointItem) {
                    let file = getFile(item.getFileId());
                    let waypoint = file?.wpt[item.getWaypointIndex()];
                    if (waypoint) {
                        return [waypoint, item.getFileId()];
                    }
                }
            }
            return undefined;
        });
    }

    let unsubscribe: (() => void) | undefined = undefined;
    function updateWaypointData(fileStore: GPXFileWithStatistics | undefined) {
        if ($selectedWaypoint) {
            if (fileStore) {
                if ($selectedWaypoint[0]._data.index < fileStore.file.wpt.length) {
                    $selectedWaypoint[0] = fileStore.file.wpt[$selectedWaypoint[0]._data.index];
                    name = $selectedWaypoint[0].name ?? '';
                    description = $selectedWaypoint[0].desc ?? '';
                    if (
                        $selectedWaypoint[0].cmt !== undefined &&
                        $selectedWaypoint[0].cmt !== $selectedWaypoint[0].desc
                    ) {
                        description += '\n\n' + $selectedWaypoint[0].cmt;
                    }
                    link = $selectedWaypoint[0].link?.attributes?.href ?? '';
                    let symbol = $selectedWaypoint[0].sym ?? '';
                    symbolKey = getSymbolKey(symbol) ?? symbol ?? '';
                    longitude = parseFloat($selectedWaypoint[0].getLongitude().toFixed(6));
                    latitude = parseFloat($selectedWaypoint[0].getLatitude().toFixed(6));
                } else {
                    selectedWaypoint.set(undefined);
                }
            } else {
                selectedWaypoint.set(undefined);
            }
        }
    }

    function resetWaypointData() {
        name = '';
        description = '';
        link = '';
        symbolKey = '';
        longitude = 0;
        latitude = 0;
    }

    $: {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = undefined;
        }
        if ($selectedWaypoint) {
            let fileStore = get(fileObservers).get($selectedWaypoint[1]);
            if (fileStore) {
                unsubscribe = fileStore.subscribe(updateWaypointData);
            }
        } else {
            resetWaypointData();
        }
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
            $selectedWaypoint
                ? new ListWaypointItem($selectedWaypoint[1], $selectedWaypoint[0]._data.index)
                : undefined
        );

        selectedWaypoint.set(undefined);
        resetWaypointData();
    }

    function setCoordinates(e: any) {
        latitude = e.lngLat.lat.toFixed(6);
        longitude = e.lngLat.lng.toFixed(6);
    }

    $: sortedSymbols = Object.entries(symbols).sort((a, b) => {
        return i18n._(`gpx.symbol.${a[0]}`).localeCompare(i18n._(`gpx.symbol.${b[0]}`), i18n.lang);
    });

    onMount(() => {
        let m = get(map);
        m?.on('click', setCoordinates);
        setCrosshairCursor();
    });

    onDestroy(() => {
        let m = get(map);
        m?.off('click', setCoordinates);
        resetCursor();

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = undefined;
        }
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-96 {$$props.class ?? ''}">
    <fieldset class="flex flex-col gap-2">
        <Label for="name">{i18n._('menu.metadata.name')}</Label>
        <Input
            bind:value={name}
            id="name"
            class="font-semibold h-8"
            disabled={!canCreate && !$selectedWaypoint}
        />
        <Label for="description">{i18n._('menu.metadata.description')}</Label>
        <Textarea
            bind:value={description}
            id="description"
            disabled={!canCreate && !$selectedWaypoint}
        />
        <Label for="symbol">{i18n._('toolbar.waypoint.icon')}</Label>
        <Select.Root bind:value={symbolKey} type="single">
            <Select.Trigger
                id="symbol"
                class="w-full h-8"
                disabled={!canCreate && !$selectedWaypoint}
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
            disabled={!canCreate && !$selectedWaypoint}
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
                    disabled={!canCreate && !$selectedWaypoint}
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
                    disabled={!canCreate && !$selectedWaypoint}
                />
            </div>
        </div>
    </fieldset>
    <div class="flex flex-row gap-2 items-center">
        <Button
            variant="outline"
            disabled={!canCreate && !$selectedWaypoint}
            class="grow whitespace-normal h-fit"
            onclick={createOrUpdateWaypoint}
        >
            {#if $selectedWaypoint}
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
                selectedWaypoint.set(undefined);
                resetWaypointData();
            }}
        >
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
