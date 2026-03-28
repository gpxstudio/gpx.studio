<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import DocsContainer from '$lib/components/docs/DocsContainer.svelte';
    import Logo from '$lib/components/Logo.svelte';
    import ElevationProfile from '$lib/components/elevation-profile/ElevationProfile.svelte';
    import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
    import {
        BookOpenText,
        Heart,
        ChartArea,
        Map,
        PencilRuler,
        PenLine,
        Route,
        Scale,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { exampleGPXFile } from '$lib/assets/example';
    import { writable } from 'svelte/store';
    import Scissors from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
    import { currentTool, Tool } from '$lib/components/toolbar/tools';
    import { onDestroy, onMount } from 'svelte';

    let {
        data,
    }: {
        data: {
            fundingModule: Promise<any>;
            translationModule: Promise<any>;
        };
    } = $props();

    let gpxStatistics = writable(exampleGPXFile.getStatistics());
    let slicedGPXStatistics = writable(undefined);
    let hoveredPoint = writable(null);
    let additionalDatasets = writable(['speed', 'atemp']);
    let elevationFill = writable(undefined);

    onMount(() => {
        $currentTool = Tool.SCISSORS;
    });

    $effect(() => {
        if ($currentTool !== Tool.SCISSORS) {
            $currentTool = Tool.SCISSORS;
        }
    });

    onDestroy(() => {
        $currentTool = null;
    });
</script>

<div class="w-full px-12 flex flex-col items-center">
    <div class="w-full max-w-5xl flex flex-col items-center">
        <div class="mt-12 flex flex-col lg:items-center gap-12">
            <div class="flex flex-col lg:items-center gap-6 max-w-3xl">
                <h1 class="text-4xl xs:text-5xl sm:text-6xl lg:text-center font-black">
                    {i18n._('metadata.home_title')}
                </h1>
                <div class="text-lg sm:text-xl text-muted-foreground lg:text-center">
                    {i18n._('metadata.description')}
                </div>
                <div class="w-full flex flex-row lg:justify-center gap-3">
                    <Button
                        data-sveltekit-reload
                        href={getURLForLanguage(i18n.lang, '/app')}
                        class="w-1/3 min-w-fit"
                    >
                        <Map size="18" />
                        {i18n._('homepage.app')}
                    </Button>
                    <Button
                        variant="secondary"
                        href={getURLForLanguage(i18n.lang, '/help')}
                        class="w-1/3 min-w-fit"
                    >
                        <BookOpenText size="18" />
                        <span>{i18n._('menu.help')}</span>
                    </Button>
                </div>
            </div>
            <enhanced:img
                src="/src/lib/assets/img/docs/getting-started/interface.webp"
                alt="The gpx.studio interface."
                class="rounded-xl shadow-2xl w-full"
            />
        </div>
        <div class="text-center text-4xl font-extrabold mt-24 mb-6">
            {i18n._('homepage.features')}
        </div>
        <div class="grid md:grid-cols-2 gap-12 border-t pt-6">
            <div class="grid md:grid-rows-subgrid md:row-start-1 md:row-end-3 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <Route size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.route_planning')}
                    </h1>
                    <p>
                        {i18n._('homepage.route_planning_description')}
                    </p>
                </div>
                <div class="relative">
                    <div
                        class="p-3 border rounded-xl shadow-xl origin-top-left scale-45 xs:scale-75 md:scale-45 lg:scale-70 absolute top-1.5 left-1.5 bg-background"
                    >
                        <Routing minimizable={false} />
                    </div>
                    <enhanced:img
                        src="/src/lib/assets/img/docs/tools/routing.png"
                        alt="Route planning illustration."
                        class="h-full object-cover rounded-xl shadow-lg"
                    />
                </div>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-1 md:row-end-3 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <Map size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.maps')}
                    </h1>
                    <p>{i18n._('homepage.maps_description')}</p>
                </div>
                <div class="relative">
                    <enhanced:img
                        src="/src/lib/assets/img/home/map.png"
                        alt="MapTiler Topo map screenshot."
                        class="h-full object-cover rounded-xl shadow-lg"
                    />
                    <enhanced:img
                        src="/src/lib/assets/img/home/map-overlay.png"
                        alt="MapTiler Topo map screenshot."
                        class="absolute top-0 left-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-200"
                    />
                </div>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-6 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <ChartArea size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.data_visualization')}
                    </h1>
                    <p>
                        {i18n._('homepage.data_visualization_description')}
                    </p>
                </div>
                <div
                    class="h-full w-full aspect-3/2 overflow-hidden flex flex-col gap-2 rounded-xl pt-6 pb-4 px-6 bg-secondary/50 border shadow-lg"
                >
                    <div class="grow">
                        <ElevationProfile
                            {gpxStatistics}
                            {slicedGPXStatistics}
                            {hoveredPoint}
                            {additionalDatasets}
                            {elevationFill}
                        />
                    </div>
                    <GPXStatistics
                        {gpxStatistics}
                        {slicedGPXStatistics}
                        orientation={'horizontal'}
                    />
                </div>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-6 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.file_processing')}
                    </h1>
                    <p>
                        {i18n._('homepage.file_processing_description')}
                    </p>
                </div>
                <div class="relative">
                    <div
                        class="p-3 border rounded-xl shadow-xl origin-top-right scale-45 xs:scale-75 md:scale-45 lg:scale-70 absolute top-1.5 right-1.5 bg-background"
                    >
                        <Scissors />
                    </div>
                    <enhanced:img
                        src="/src/lib/assets/img/docs/tools/split.png"
                        alt="Splitting illustration."
                        class="h-full object-cover rounded-xl shadow-lg"
                    />
                </div>
            </div>
        </div>
        <div class="text-center text-4xl font-extrabold mt-24 mb-6">
            {i18n._('homepage.philosophy')}
        </div>
        <div class="grid md:grid-cols-2 gap-12 border-t pt-6">
            <div class="grid md:grid-rows-subgrid md:row-start-1 md:row-end-3 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        Free and ad-free
                    </h1>
                    <p>explanation</p>
                </div>
                <p>image?</p>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-1 md:row-end-3 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        Privacy first
                    </h1>
                    <p>explanation</p>
                </div>
                <p>image?</p>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-6 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        Free and ad-free
                    </h1>
                    <p>explanation</p>
                </div>
                <p>image?</p>
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-6 gap-4">
                <div class="markdown homepage">
                    <h1>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        Free and ad-free
                    </h1>
                    <p>explanation</p>
                </div>
                <p>image?</p>
            </div>
        </div>
        <div class="px-12 sm:px-24 w-full flex flex-col items-center">
            <div
                class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl"
            >
                <div class="markdown text-center md:hidden">
                    <h1>
                        <Scale size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.identity')}
                    </h1>
                    <p class="text-muted-foreground">{i18n._('homepage.identity_description')}</p>
                </div>
                <a href="https://github.com/gpxstudio/gpx.studio" target="_blank">
                    <Logo class="h-32" company="github" />
                </a>
                <div class="markdown text-center hidden md:block">
                    <h1>
                        <Scale size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.identity')}
                    </h1>
                    <p class="text-muted-foreground">{i18n._('homepage.identity_description')}</p>
                </div>
            </div>
        </div>
        <div class="flex flex-row flex-wrap lg:flex-nowrap items-center justify-center">
            <div
                class="grow max-w-xl flex flex-col items-center gap-6 p-8 border rounded-2xl shadow-xl"
            >
                {#await data.fundingModule then fundingModule}
                    <DocsContainer module={fundingModule.default} />
                {/await}
                <Button
                    href="https://opencollective.com/gpxstudio"
                    target="_blank"
                    class="text-base"
                >
                    <Heart size="16" fill="var(--support)" color="var(--support)" />
                    <span>{i18n._('homepage.support_button')}</span>
                </Button>
            </div>
            <div
                class="grow max-w-lg mx-6 h-fit bg-background flex flex-col items-center gap-6 p-8 border rounded-2xl shadow-xl"
            >
                {#await data.translationModule then translationModule}
                    <DocsContainer module={translationModule.default} />
                {/await}
                <Button
                    href="https://crowdin.com/project/gpxstudio"
                    target="_blank"
                    class="text-base"
                >
                    <PenLine size="16" />
                    <span>{i18n._('homepage.contribute')}</span>
                </Button>
            </div>
        </div>
    </div>
</div>

<style lang="postcss">
    @reference "../../app.css";

    :global(.markdown.homepage > h1) {
        @apply text-2xl;
        @apply pt-0;
    }
</style>
