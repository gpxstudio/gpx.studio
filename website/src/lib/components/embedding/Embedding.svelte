<script lang="ts">
    import GPXLayers from '$lib/components/map/gpx-layer/GPXLayers.svelte';
    import ElevationProfile from '$lib/components/elevation-profile/ElevationProfile.svelte';
    import FileList from '$lib/components/file-list/FileList.svelte';
    import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Map from '$lib/components/map/Map.svelte';
    import LayerControl from '$lib/components/map/layer-control/LayerControl.svelte';
    import OpenIn from '$lib/components/embedding/OpenIn.svelte';
    import { readable, writable } from 'svelte/store';
    import type { GPXFile } from 'gpx';
    import {
        allowedEmbeddingBasemaps,
        getFilesFromEmbeddingOptions,
        type EmbeddingOptions,
    } from './embedding';
    import { setMode } from 'mode-watcher';
    import { settings } from '$lib/logic/settings';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { gpxStatistics, slicedGPXStatistics } from '$lib/logic/statistics';
    import { GPXStatisticsTree } from '$lib/logic/statistics-tree';
    import { loadFile } from '$lib/logic/file-actions';
    import { selection } from '$lib/logic/selection';
    import { untrack } from 'svelte';

    let {
        useHash = true,
        options = $bindable(),
        hash = $bindable(),
    }: { useHash?: boolean; options: EmbeddingOptions; hash: string } = $props();

    let additionalDatasets = writable<string[]>([]);
    let elevationFill = writable<'slope' | 'surface' | 'highway' | undefined>(undefined);

    const {
        currentBasemap,
        distanceUnits,
        velocityUnits,
        temperatureUnits,
        fileOrder,
        distanceMarkers,
        directionMarkers,
    } = settings;

    function applyOptions() {
        let downloads: Promise<GPXFile | null>[] = getFilesFromEmbeddingOptions(options).map(
            (url) => {
                return fetch(url)
                    .then((response) => response.blob())
                    .then((blob) => new File([blob], url.split('/').pop() ?? url))
                    .then(loadFile);
            }
        );
        Promise.all(downloads).then((answers) => {
            const files = answers.filter((file) => file !== null) as GPXFile[];
            let ids: string[] = [];
            files.forEach((file, index) => {
                let id = `gpx-${index}-embed`;
                file._data.id = id;
                ids.push(id);
            });
            fileStateCollection.setEmbeddedFiles(files);
            $fileOrder = ids;
            selection.selectAll();
        });
        if (allowedEmbeddingBasemaps.includes(options.basemap)) {
            $currentBasemap = options.basemap;
        }
        $distanceMarkers = options.distanceMarkers;
        $directionMarkers = options.directionMarkers;
        $distanceUnits = options.distanceUnits;
        $velocityUnits = options.velocityUnits;
        $temperatureUnits = options.temperatureUnits;
        if (options.theme != 'system') {
            setMode(options.theme);
        }

        additionalDatasets.set(
            [
                options.elevation.speed ? 'speed' : null,
                options.elevation.hr ? 'hr' : null,
                options.elevation.cad ? 'cad' : null,
                options.elevation.temp ? 'temp' : null,
                options.elevation.power ? 'power' : null,
            ].filter((dataset) => dataset !== null)
        );
        elevationFill.set(options.elevation.fill == 'none' ? undefined : options.elevation.fill);
    }

    $effect(() => {
        options;
        untrack(applyOptions);
    });
</script>

<div class="absolute flex flex-col h-full w-full border rounded-xl overflow-clip">
    <div class="grow relative">
        <Map
            class="h-full {$fileStateCollection.size > 1 ? 'horizontal' : ''}"
            accessToken={options.token}
            geocoder={false}
            geolocate={true}
            hash={useHash}
        />
        <OpenIn files={options.files} ids={options.ids} />
        <LayerControl />
        <GPXLayers />
        {#if $fileStateCollection.size > 1}
            <div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
                <FileList orientation="horizontal" />
            </div>
        {/if}
    </div>
    <div
        class="{options.elevation.show ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
        style={options.elevation.show ? `height: ${options.elevation.height}px` : ''}
    >
        <GPXStatistics
            {gpxStatistics}
            {slicedGPXStatistics}
            panelSize={options.elevation.height}
            orientation={options.elevation.show ? 'vertical' : 'horizontal'}
        />
        {#if options.elevation.show}
            <ElevationProfile
                {gpxStatistics}
                {slicedGPXStatistics}
                {additionalDatasets}
                {elevationFill}
                showControls={options.elevation.controls}
            />
        {/if}
    </div>
</div>
