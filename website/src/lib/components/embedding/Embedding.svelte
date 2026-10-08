<script lang="ts">
    import GPXLayers from '$lib/components/map/gpx-layer/GPXLayers.svelte';
    import ElevationProfile from '$lib/components/elevation-profile/ElevationProfile.svelte';
    import FileList from '$lib/components/file-list/FileList.svelte';
    import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Map from '$lib/components/map/Map.svelte';
    import LayerControl from '$lib/components/map/layer-control/LayerControl.svelte';
    import OpenIn from '$lib/components/embedding/OpenIn.svelte';
    import { writable } from 'svelte/store';
    import {
        allowedEmbeddingBasemaps,
        getFilesFromEmbeddingOptions,
        type EmbeddingOptions,
    } from './embedding';
    import { setMode } from 'mode-watcher';
    import { settings } from '$lib/logic/settings';
    import { loadFiles } from '$lib/logic/file-actions';
    import { untrack } from 'svelte';
    import { isSelected, toggle } from '$lib/components/map/layer-control/utils';
    import { engine } from '$lib/engine';
    import { hoveredPoint, slicedStatistics } from '$lib/logic/selection-statistics';

    let {
        useHash = true,
        options = $bindable(),
        hash = $bindable(),
    }: { useHash?: boolean; options: EmbeddingOptions; hash: string } = $props();

    const { files } = engine;

    let additionalDatasets = writable<string[]>([]);
    let elevationFill = writable<'slope' | 'surface' | 'highway' | undefined>(undefined);

    const { statistics } = engine;
    const {
        currentBasemap,
        selectedBasemapTree,
        distanceUnits,
        velocityUnits,
        temperatureUnits,
        distanceMarkers,
        directionMarkers,
    } = settings;

    settings.initialize();

    function applyOptions() {
        if (allowedEmbeddingBasemaps.includes(options.basemap)) {
            $currentBasemap = options.basemap;
        }
        if (!isSelected($selectedBasemapTree, options.basemap)) {
            $selectedBasemapTree = toggle($selectedBasemapTree, options.basemap);
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

        let downloads: Promise<File>[] = getFilesFromEmbeddingOptions(options).map((url) => {
            return fetch(url)
                .then((response) => response.blob())
                .then((blob) => new File([blob], url.split('/').pop() ?? url));
        });
        Promise.all(downloads)
            .then(loadFiles)
            .then(() => engine.selectAll());
    }

    $effect(() => {
        options;
        untrack(applyOptions);
    });
</script>

<div class="absolute flex flex-col h-full w-full border rounded-xl overflow-clip">
    <div class="grow relative">
        <Map
            class="h-full {$files.size > 1 ? 'horizontal' : ''}"
            maptilerKey={options.key}
            geocoder={false}
            geolocate={true}
            hash={useHash}
        />
        <OpenIn files={options.files} ids={options.ids} />
        <LayerControl />
        <GPXLayers />
        {#if $files.size > 1}
            <div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
                <FileList orientation="horizontal" />
            </div>
        {/if}
    </div>
    <div
        class="{options.elevation.show ? '' : 'h-10'} flex flex-row gap-2 p-2 sm:px-4"
        style={options.elevation.show ? `height: ${options.elevation.height}px` : ''}
    >
        <GPXStatistics
            {statistics}
            {slicedStatistics}
            orientation={options.elevation.show ? 'vertical' : 'horizontal'}
        />
        {#if options.elevation.show}
            <ElevationProfile
                {statistics}
                {slicedStatistics}
                {hoveredPoint}
                {additionalDatasets}
                {elevationFill}
                showControls={options.elevation.controls}
            />
        {/if}
    </div>
</div>
