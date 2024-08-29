<script lang="ts">
    import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
    import ElevationProfile from '$lib/components/ElevationProfile.svelte';
    import FileList from '$lib/components/file-list/FileList.svelte';
    import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Map from '$lib/components/Map.svelte';
    import Menu from '$lib/components/Menu.svelte';
    import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
    import StreetViewControl from '$lib/components/street-view-control/StreetViewControl.svelte';
    import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
    import Resizer from '$lib/components/Resizer.svelte';
    import { Toaster } from '$lib/components/ui/sonner';

    import { observeFilesFromDatabase, settings } from '$lib/db';
    import { gpxStatistics, loadFiles, slicedGPXStatistics } from '$lib/stores';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { languages } from '$lib/languages';
    import { getURLForLanguage } from '$lib/utils';

    const {
        verticalFileView,
        elevationProfile,
        bottomPanelSize,
        rightPanelSize,
        additionalDatasets,
        elevationFill
    } = settings;

    onMount(() => {
        observeFilesFromDatabase();

        let files = JSON.parse($page.url.searchParams.get('files') || '[]');

        if (files.length > 0) {
            let downloads: Promise<File | null>[] = [];
            files.forEach((url) => {
                downloads.push(
                    fetch(url)
                        .then((response) => response.blob())
                        .then((blob) => new File([blob], url.split('/').pop()))
                );
            });

            Promise.all(downloads).then((files) => {
                files = files.filter((file) => file !== null);
                loadFiles(files);
            });
        }
    });
</script>

<div class="fixed flex flex-row w-screen h-screen h-dvh">
    <div class="flex flex-col grow h-full min-w-0">
        <div class="grow relative">
            <Menu />
            <div
                class="absolute top-0 bottom-0 left-0 z-40 flex flex-col justify-center pointer-events-none"
            >
                <Toolbar />
            </div>
            <Map class="h-full {$verticalFileView ? '' : 'horizontal'}" />
            <StreetViewControl />
            <LayerControl />
            <GPXLayers />
            <Toaster richColors />
            {#if !$verticalFileView}
                <div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
                    <FileList orientation="horizontal" />
                </div>
            {/if}
        </div>
        {#if $elevationProfile}
            <Resizer
                orientation="row"
                bind:after={$bottomPanelSize}
                minAfter={100}
                maxAfter={300}
            />
        {/if}
        <div
            class="{$elevationProfile ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
            style={$elevationProfile ? `height: ${$bottomPanelSize}px` : ''}
        >
            <GPXStatistics
                {gpxStatistics}
                {slicedGPXStatistics}
                panelSize={$bottomPanelSize}
                orientation={$elevationProfile ? 'vertical' : 'horizontal'}
            />
            {#if $elevationProfile}
                <ElevationProfile
                    {gpxStatistics}
                    {slicedGPXStatistics}
                    bind:additionalDatasets={$additionalDatasets}
                    bind:elevationFill={$elevationFill}
                    panelSize={$bottomPanelSize}
                    class="py-2"
                />
            {/if}
        </div>
    </div>
    {#if $verticalFileView}
        <Resizer orientation="col" bind:after={$rightPanelSize} minAfter={100} maxAfter={400} />
        <FileList orientation="vertical" recursive={true} style="width: {$rightPanelSize}px" />
    {/if}
</div>

<!-- hidden links for svelte crawling -->
<div class="hidden">
    {#each Object.entries(languages) as [lang, label]}
        <a href={getURLForLanguage(lang, '/embed')}>
            {label}
        </a>
    {/each}
</div>

<style lang="postcss">
    div :global(.toaster.group) {
        @apply absolute;
        @apply right-2;
        --offset: 50px !important;
    }
</style>
