<script lang="ts">
    // import GPXLayers from '$lib/components/map/gpx-layer/GPXLayers.svelte';
    // import ElevationProfile from '$lib/components/elevation-profile/ElevationProfile.svelte';
    // import FileList from '$lib/components/file-list/FileList.svelte';
    // import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Map from '$lib/components/map/Map.svelte';
    import { map } from '$lib/components/map/map';
    // import LayerControl from '$lib/components/map/layer-control/LayerControl.svelte';
    import OpenIn from '$lib/components/embedding/OpenIn.svelte';
    import {
        gpxStatistics,
        slicedGPXStatistics,
        embedding,
        loadFile,
        updateGPXData,
    } from '$lib/stores';
    import { onDestroy, onMount, setContext } from 'svelte';
    import { readable } from 'svelte/store';
    import type { GPXFile } from 'gpx';
    import { ListFileItem } from '$lib/components/file-list/file-list';
    import {
        allowedEmbeddingBasemaps,
        getFilesFromEmbeddingOptions,
        type EmbeddingOptions,
    } from './Embedding';
    import { mode, setMode } from 'mode-watcher';
    import { browser } from '$app/environment';
    import { settings } from '$lib/logic/settings';
    import { fileStateCollection } from '$lib/logic/file-state';

    let {
        useHash = true,
        options = $bindable(),
        hash,
    }: { useHash?: boolean; options: EmbeddingOptions; hash: string } = $props();

    setContext('embedding', true);

    const {
        currentBasemap,
        distanceUnits,
        velocityUnits,
        temperatureUnits,
        fileOrder,
        distanceMarkers,
        directionMarkers,
    } = settings;

    let prevSettings: {
        distanceMarkers: boolean;
        directionMarkers: boolean;
        distanceUnits: 'metric' | 'imperial' | 'nautical';
        velocityUnits: 'speed' | 'pace';
        temperatureUnits: 'celsius' | 'fahrenheit';
        theme: 'light' | 'dark' | 'system';
    } = {
        distanceMarkers: false,
        directionMarkers: false,
        distanceUnits: 'metric',
        velocityUnits: 'speed',
        temperatureUnits: 'celsius',
        theme: 'system',
    };

    function applyOptions() {
        // fileObservers.update(($fileObservers) => {
        //     $fileObservers.clear();
        //     return $fileObservers;
        // });
        // let downloads: Promise<GPXFile | null>[] = [];
        // getFilesFromEmbeddingOptions(options).forEach((url) => {
        //     downloads.push(
        //         fetch(url)
        //             .then((response) => response.blob())
        //             .then((blob) => new File([blob], url.split('/').pop() ?? url))
        //             .then(loadFile)
        //     );
        // });
        // Promise.all(downloads).then((files) => {
        //     let ids: string[] = [];
        //     let bounds = {
        //         southWest: {
        //             lat: 90,
        //             lon: 180,
        //         },
        //         northEast: {
        //             lat: -90,
        //             lon: -180,
        //         },
        //     };
        //     fileObservers.update(($fileObservers) => {
        //         files.forEach((file, index) => {
        //             if (file === null) {
        //                 return;
        //             }
        //             let id = `gpx-${index}-embed`;
        //             file._data.id = id;
        //             let statistics = new GPXStatisticsTree(file);
        //             $fileObservers.set(
        //                 id,
        //                 readable({
        //                     file,
        //                     statistics,
        //                 })
        //             );
        //             ids.push(id);
        //             let fileBounds = statistics.getStatisticsFor(new ListFileItem(id)).global
        //                 .bounds;
        //             bounds.southWest.lat = Math.min(bounds.southWest.lat, fileBounds.southWest.lat);
        //             bounds.southWest.lon = Math.min(bounds.southWest.lon, fileBounds.southWest.lon);
        //             bounds.northEast.lat = Math.max(bounds.northEast.lat, fileBounds.northEast.lat);
        //             bounds.northEast.lon = Math.max(bounds.northEast.lon, fileBounds.northEast.lon);
        //         });
        //         return $fileObservers;
        //     });
        //     $fileOrder = [...$fileOrder.filter((id) => !id.includes('embed')), ...ids];
        //     selection.update(($selection) => {
        //         $selection.clear();
        //         ids.forEach((id) => {
        //             $selection.toggle(new ListFileItem(id));
        //         });
        //         return $selection;
        //     });
        //     if (hash.length === 0) {
        //         map.subscribe(($map) => {
        //             if ($map) {
        //                 $map.fitBounds(
        //                     [
        //                         bounds.southWest.lon,
        //                         bounds.southWest.lat,
        //                         bounds.northEast.lon,
        //                         bounds.northEast.lat,
        //                     ],
        //                     {
        //                         padding: 80,
        //                         linear: true,
        //                         easing: () => 1,
        //                     }
        //                 );
        //             }
        //         });
        //     }
        // });
        // if (
        //     options.basemap !== $currentBasemap &&
        //     allowedEmbeddingBasemaps.includes(options.basemap)
        // ) {
        //     $currentBasemap = options.basemap;
        // }
        // if (options.distanceMarkers !== $distanceMarkers) {
        //     $distanceMarkers = options.distanceMarkers;
        // }
        // if (options.directionMarkers !== $directionMarkers) {
        //     $directionMarkers = options.directionMarkers;
        // }
        // if (options.distanceUnits !== $distanceUnits) {
        //     $distanceUnits = options.distanceUnits;
        // }
        // if (options.velocityUnits !== $velocityUnits) {
        //     $velocityUnits = options.velocityUnits;
        // }
        // if (options.temperatureUnits !== $temperatureUnits) {
        //     $temperatureUnits = options.temperatureUnits;
        // }
        // if (options.theme !== $mode) {
        //     setMode(options.theme);
        // }
    }

    onMount(() => {
        prevSettings.distanceMarkers = distanceMarkers.value;
        prevSettings.directionMarkers = directionMarkers.value;
        prevSettings.distanceUnits = distanceUnits.value;
        prevSettings.velocityUnits = velocityUnits.value;
        prevSettings.temperatureUnits = temperatureUnits.value;
        prevSettings.theme = mode.current ?? 'system';
    });

    // $: if (browser && options) {
    //     applyOptions();
    // }

    // $: if ($fileOrder) {
    //     updateGPXData();
    // }

    onDestroy(() => {
        if (distanceMarkers.value !== prevSettings.distanceMarkers) {
            distanceMarkers.value = prevSettings.distanceMarkers;
        }

        if (directionMarkers.value !== prevSettings.directionMarkers) {
            directionMarkers.value = prevSettings.directionMarkers;
        }

        if (distanceUnits.value !== prevSettings.distanceUnits) {
            distanceUnits.value = prevSettings.distanceUnits;
        }

        if (velocityUnits.value !== prevSettings.velocityUnits) {
            velocityUnits.value = prevSettings.velocityUnits;
        }

        if (temperatureUnits.value !== prevSettings.temperatureUnits) {
            temperatureUnits.value = prevSettings.temperatureUnits;
        }

        if (mode.current !== prevSettings.theme) {
            setMode(prevSettings.theme);
        }

        // $selection.clear();
        // $fileObservers.clear();
        fileOrder.value = fileOrder.value.filter((id) => !id.includes('embed'));
    });
</script>

<div class="absolute flex flex-col h-full w-full border rounded-xl overflow-clip">
    <div class="grow relative">
        <Map
            class="h-full {fileStateCollection.files.size > 1 ? 'horizontal' : ''}"
            accessToken={options.token}
            geocoder={false}
            geolocate={false}
            hash={useHash}
        />
        <OpenIn files={options.files} ids={options.ids} />
        <!-- <LayerControl /> -->
        <!-- <GPXLayers /> -->
        {#if fileStateCollection.files.size > 1}
            <div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
                <!-- <FileList orientation="horizontal" /> -->
            </div>
        {/if}
    </div>
    <div
        class="{options.elevation.show ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
        style={options.elevation.show ? `height: ${options.elevation.height}px` : ''}
    >
        <!-- <GPXStatistics
            {gpxStatistics}
            {slicedGPXStatistics}
            panelSize={options.elevation.height}
            orientation={options.elevation.show ? 'vertical' : 'horizontal'}
        /> -->
        {#if options.elevation.show}
            <!-- <ElevationProfile
                {gpxStatistics}
                {slicedGPXStatistics}
                additionalDatasets={[
                    options.elevation.speed ? 'speed' : null,
                    options.elevation.hr ? 'hr' : null,
                    options.elevation.cad ? 'cad' : null,
                    options.elevation.temp ? 'temp' : null,
                    options.elevation.power ? 'power' : null,
                ].filter((dataset) => dataset !== null)}
                elevationFill={options.elevation.fill}
                showControls={options.elevation.controls}
            /> -->
        {/if}
    </div>
</div>
