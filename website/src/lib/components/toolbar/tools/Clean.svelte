<script lang="ts" context="module">
    enum CleanType {
        INSIDE = 'inside',
        OUTSIDE = 'outside',
    }
</script>

<script lang="ts">
    import { Label } from '$lib/components/ui/label/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import * as RadioGroup from '$lib/components/ui/radio-group';
    import { Button } from '$lib/components/ui/button';
    import Help from '$lib/components/Help.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { onDestroy, onMount } from 'svelte';
    import { getURLForLanguage, resetCursor, setCrosshairCursor } from '$lib/utils';
    import { Trash2 } from '@lucide/svelte';
    import { map } from '$lib/components/map/map.svelte';
    import { selection } from '$lib/components/file-list/Selection';
    import { dbUtils } from '$lib/db';
    import type { GeoJSONSource } from 'mapbox-gl';

    let cleanType = CleanType.INSIDE;
    let deleteTrackpoints = true;
    let deleteWaypoints = true;
    let rectangleCoordinates: mapboxgl.LngLat[] = [];

    function updateRectangle() {
        if (map.current) {
            if (rectangleCoordinates.length != 2) {
                if (map.current.getLayer('rectangle')) {
                    map.current.removeLayer('rectangle');
                }
            } else {
                let data: GeoJSON.Feature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [rectangleCoordinates[0].lng, rectangleCoordinates[0].lat],
                                [rectangleCoordinates[1].lng, rectangleCoordinates[0].lat],
                                [rectangleCoordinates[1].lng, rectangleCoordinates[1].lat],
                                [rectangleCoordinates[0].lng, rectangleCoordinates[1].lat],
                                [rectangleCoordinates[0].lng, rectangleCoordinates[0].lat],
                            ],
                        ],
                    },
                    properties: {},
                };
                let source: GeoJSONSource | undefined = map.current.getSource('rectangle');
                if (source) {
                    source.setData(data);
                } else {
                    map.current.addSource('rectangle', {
                        type: 'geojson',
                        data: data,
                    });
                }
                if (!map.current.getLayer('rectangle')) {
                    map.current.addLayer({
                        id: 'rectangle',
                        type: 'fill',
                        source: 'rectangle',
                        paint: {
                            'fill-color': 'SteelBlue',
                            'fill-opacity': 0.5,
                        },
                    });
                }
            }
        }
    }

    $: if (rectangleCoordinates) {
        updateRectangle();
    }

    let mousedown = false;
    function onMouseDown(e: any) {
        mousedown = true;
        rectangleCoordinates = [e.lngLat, e.lngLat];
    }

    function onMouseMove(e: any) {
        if (mousedown) {
            rectangleCoordinates[1] = e.lngLat;
        }
    }

    function onMouseUp(e: any) {
        mousedown = false;
    }

    onMount(() => {
        if (map.current) {
            setCrosshairCursor(map.current.getCanvas());
            map.current.on('mousedown', onMouseDown);
            map.current.on('mousemove', onMouseMove);
            map.current.on('mouseup', onMouseUp);
            map.current.on('touchstart', onMouseDown);
            map.current.on('touchmove', onMouseMove);
            map.current.on('touchend', onMouseUp);
            map.current.dragPan.disable();
        }
    });

    onDestroy(() => {
        if (map.current) {
            resetCursor(map.current.getCanvas());
            map.current.off('mousedown', onMouseDown);
            map.current.off('mousemove', onMouseMove);
            map.current.off('mouseup', onMouseUp);
            map.current.off('touchstart', onMouseDown);
            map.current.off('touchmove', onMouseMove);
            map.current.off('touchend', onMouseUp);
            map.current.dragPan.enable();

            if (map.current.getLayer('rectangle')) {
                map.current.removeLayer('rectangle');
            }
            if (map.current.getSource('rectangle')) {
                map.current.removeSource('rectangle');
            }
        }
    });

    $: validSelection = $selection.size > 0;
</script>

<div class="flex flex-col gap-3 w-full max-w-80 items-center {$$props.class ?? ''}">
    <fieldset class="flex flex-col gap-3">
        <div class="flex flex-row items-center gap-[6.4px] h-3">
            <Checkbox id="delete-trkpt" bind:checked={deleteTrackpoints} class="scale-90" />
            <Label for="delete-trkpt">
                {i18n._('toolbar.clean.delete_trackpoints')}
            </Label>
        </div>
        <div class="flex flex-row items-center gap-[6.4px] h-3">
            <Checkbox id="delete-wpt" bind:checked={deleteWaypoints} class="scale-90" />
            <Label for="delete-wpt">
                {i18n._('toolbar.clean.delete_waypoints')}
            </Label>
        </div>
        <RadioGroup.Root bind:value={cleanType}>
            <Label class="flex flex-row items-center gap-2">
                <RadioGroup.Item value={CleanType.INSIDE} />
                {i18n._('toolbar.clean.delete_inside')}
            </Label>
            <Label class="flex flex-row items-center gap-2">
                <RadioGroup.Item value={CleanType.OUTSIDE} />
                {i18n._('toolbar.clean.delete_outside')}
            </Label>
        </RadioGroup.Root>
    </fieldset>
    <Button
        variant="outline"
        class="w-full"
        disabled={!validSelection || rectangleCoordinates.length != 2}
        onclick={() => {
            dbUtils.cleanSelection(
                [
                    {
                        lat: Math.min(rectangleCoordinates[0].lat, rectangleCoordinates[1].lat),
                        lon: Math.min(rectangleCoordinates[0].lng, rectangleCoordinates[1].lng),
                    },
                    {
                        lat: Math.max(rectangleCoordinates[0].lat, rectangleCoordinates[1].lat),
                        lon: Math.max(rectangleCoordinates[0].lng, rectangleCoordinates[1].lng),
                    },
                ],
                cleanType === CleanType.INSIDE,
                deleteTrackpoints,
                deleteWaypoints
            );
            rectangleCoordinates = [];
        }}
    >
        <Trash2 size="16" class="mr-1" />
        {i18n._('toolbar.clean.button')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/clean')}>
        {#if validSelection}
            {i18n._('toolbar.clean.help')}
        {:else}
            {i18n._('toolbar.clean.help_no_selection')}
        {/if}
    </Help>
</div>
