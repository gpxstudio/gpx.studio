<script lang="ts">
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Slider } from '$lib/components/ui/slider';
    import {
        ListItem,
        ListRootItem,
        ListTrackSegmentItem,
    } from '$lib/components/file-list/file-list';
    import Help from '$lib/components/Help.svelte';
    import { Funnel } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import WithUnits from '$lib/components/WithUnits.svelte';
    import { map } from '$lib/components/map/utils.svelte';
    import { onDestroy } from 'svelte';
    import { ramerDouglasPeucker, TrackPoint, type SimplifiedTrackPoint } from 'gpx';
    import { getURLForLanguage } from '$lib/utils';
    import type { GeoJSONSource } from 'mapbox-gl';
    import { selection } from '$lib/logic/selection.svelte';
    import { fileActions } from '$lib/logic/file-actions.svelte';

    let props: { class?: string } = $props();

    let sliderValue = $state([50]);
    let maxPoints = $state(0);
    let currentPoints = $state(0);
    const minTolerance = 0.1;
    const maxTolerance = 10000;

    let validSelection = $derived(
        selection.value.hasAnyChildren(new ListRootItem(), true, ['waypoints'])
    );
    let tolerance = $derived(
        minTolerance * 2 ** (sliderValue[0] / (100 / Math.log2(maxTolerance / minTolerance)))
    );

    let simplified = new Map<string, [ListItem, number, SimplifiedTrackPoint[]]>();
    let unsubscribes = new Map<string, () => void>();

    function update() {
        maxPoints = 0;
        currentPoints = 0;

        let data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };

        simplified.forEach(([item, maxPts, points], itemFullId) => {
            maxPoints += maxPts;

            let current = points.filter(
                (point) => point.distance === undefined || point.distance >= tolerance
            );
            currentPoints += current.length;

            data.features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: current.map((point) => [
                        point.point.getLongitude(),
                        point.point.getLatitude(),
                    ]),
                },
                properties: {},
            });
        });

        if (map.value) {
            let source: GeoJSONSource | undefined = map.value.getSource('simplified');
            if (source) {
                source.setData(data);
            } else {
                map.value.addSource('simplified', {
                    type: 'geojson',
                    data: data,
                });
            }
            if (!map.value.getLayer('simplified')) {
                map.value.addLayer({
                    id: 'simplified',
                    type: 'line',
                    source: 'simplified',
                    paint: {
                        'line-color': 'white',
                        'line-width': 3,
                    },
                });
            } else {
                map.value.moveLayer('simplified');
            }
        }
    }

    // $effect(() => {
    //     if ($fileObservers) {
    //         unsubscribes.forEach((unsubscribe, fileId) => {
    //             if (!$fileObservers.has(fileId)) {
    //                 unsubscribe();
    //                 unsubscribes.delete(fileId);
    //             }
    //         });
    //         $fileObservers.forEach((fileStore, fileId) => {
    //             if (!unsubscribes.has(fileId)) {
    //                 let unsubscribe = derived([fileStore, selection], ([fs, sel]) => [
    //                     fs,
    //                     sel,
    //                 ]).subscribe(([fs, sel]) => {
    //                     if (fs) {
    //                         fs.file.forEachSegment((segment, trackIndex, segmentIndex) => {
    //                             let segmentItem = new ListTrackSegmentItem(
    //                                 fileId,
    //                                 trackIndex,
    //                                 segmentIndex
    //                             );
    //                             if (sel.hasAnyParent(segmentItem)) {
    //                                 let statistics = fs.statistics.getStatisticsFor(segmentItem);
    //                                 simplified.set(segmentItem.getFullId(), [
    //                                     segmentItem,
    //                                     statistics.local.points.length,
    //                                     ramerDouglasPeucker(statistics.local.points, minTolerance),
    //                                 ]);
    //                                 update();
    //                             } else if (simplified.has(segmentItem.getFullId())) {
    //                                 simplified.delete(segmentItem.getFullId());
    //                                 update();
    //                             }
    //                         });
    //                     }
    //                 });
    //                 unsubscribes.set(fileId, unsubscribe);
    //             }
    //         });
    //     }
    // });

    $effect(() => {
        if (tolerance) {
            update();
        }
    });

    onDestroy(() => {
        if (map.value) {
            if (map.value.getLayer('simplified')) {
                map.value.removeLayer('simplified');
            }
            if (map.value.getSource('simplified')) {
                map.value.removeSource('simplified');
            }
        }
        unsubscribes.forEach((unsubscribe) => unsubscribe());
        simplified.clear();
    });

    function reduce() {
        let itemsAndPoints = new Map<ListItem, TrackPoint[]>();
        simplified.forEach(([item, maxPts, points], itemFullId) => {
            itemsAndPoints.set(
                item,
                points
                    .filter((point) => point.distance === undefined || point.distance >= tolerance)
                    .map((point) => point.point)
            );
        });
        fileActions.reduce(itemsAndPoints);
    }
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <div class="p-2">
        <Slider bind:value={sliderValue} min={0} max={100} step={1} type="multiple" />
    </div>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.tolerance')}</span>
        <WithUnits value={tolerance / 1000} type="distance" decimals={4} class="font-normal" />
    </Label>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.number_of_points')}</span>
        <span class="font-normal">{currentPoints}/{maxPoints}</span>
    </Label>
    <Button variant="outline" disabled={!validSelection} onclick={reduce}>
        <Funnel size="16" class="mr-1" />
        {i18n._('toolbar.reduce.button')}
    </Button>

    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/minify')}>
        {#if validSelection}
            {i18n._('toolbar.reduce.help')}
        {:else}
            {i18n._('toolbar.reduce.help_no_selection')}
        {/if}
    </Help>
</div>
