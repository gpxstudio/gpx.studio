<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import ElevationProfile from '$lib/components/elevation-profile/ElevationProfile.svelte';
    import GPXStatistics from '$lib/components/GPXStatistics.svelte';
    import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
    import {
        BookOpenText,
        Heart,
        HeartHandshake,
        ChartArea,
        Map,
        PencilRuler,
        Route,
        Scale,
        HatGlasses,
        Languages,
        ExternalLink,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { exampleGPXFile } from '$lib/assets/example';
    import { writable } from 'svelte/store';
    import Scissors from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
    import { currentTool, Tool } from '$lib/components/toolbar/tools';
    import { onDestroy, onMount } from 'svelte';

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
        <div class="mt-12 flex flex-col xs:items-center gap-12">
            <div class="flex flex-col xs:items-center gap-6 max-w-3xl">
                <h1 class="text-4xl xs:text-5xl sm:text-6xl xs:text-center font-black">
                    {i18n._('metadata.home_title')}
                </h1>
                <div class="text-lg sm:text-xl text-muted-foreground xs:text-center">
                    {i18n._('metadata.description')}
                </div>
                <div class="w-full flex flex-row xs:justify-center gap-3">
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
            <a href={getURLForLanguage(i18n.lang, '/app')} aria-label="Link to the web app.">
                <enhanced:img
                    src="/src/lib/assets/img/docs/getting-started/interface.webp"
                    alt="The gpx.studio interface."
                    class="rounded-xl shadow-2xl w-full"
                /></a
            >
        </div>
        <h2>
            {i18n._('homepage.features')}
        </h2>
        <div class="grid md:grid-cols-2 gap-12 border-t pt-6">
            <div class="grid md:grid-rows-subgrid md:row-start-1 md:row-end-3 gap-4">
                <div>
                    <h3>
                        <Route size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.route_planning')}
                    </h3>
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
                <div>
                    <h3>
                        <Map size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.maps')}
                    </h3>
                    <p>{i18n._('homepage.maps_description')}</p>
                </div>
                <enhanced:img
                    src="/src/lib/assets/img/home/map-overlay.png"
                    alt="3D map with multiple layers and points of interest."
                    class="h-full object-cover rounded-xl shadow-lg"
                />
            </div>
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-5 gap-4">
                <div>
                    <h3>
                        <ChartArea size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.data_visualization')}
                    </h3>
                    <p>
                        {i18n._('homepage.data_visualization_description')}
                    </p>
                </div>
                <div
                    class="w-full aspect-3/2 overflow-hidden flex flex-col gap-2 rounded-xl pt-6 pb-4 px-6 bg-secondary/50 border shadow-lg"
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
            <div class="grid md:grid-rows-subgrid md:row-start-3 md:row-end-5 gap-4">
                <div>
                    <h3>
                        <PencilRuler size="20" class="inline-block align-baseline" />
                        {i18n._('homepage.file_processing')}
                    </h3>
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
        <h2>
            {i18n._('homepage.philosophy')}
        </h2>
        <div class="w-full grid md:grid-cols-2 gap-12 border-t pt-6">
            <div class="w-full">
                <h3>
                    <Scale size="20" class="inline-block align-baseline" />
                    {i18n._('homepage.foss')}
                </h3>
                <p>
                    {i18n._('homepage.foss_description')}
                    <Button
                        variant="link"
                        href="https://github.com/gpxstudio/gpx.studio"
                        target="_blank"
                        class="p-0 has-[>svg]:p-0 h-fit"
                    >
                        <ExternalLink size="20" class="inline-block align-baseline" />
                    </Button>
                </p>
            </div>
            <div>
                <h3>
                    <HatGlasses size="20" class="inline-block align-baseline" />
                    {i18n._('homepage.privacy')}
                </h3>
                <p>{i18n._('homepage.privacy_description')}</p>
            </div>
        </div>
        <div
            class="md:text-center flex flex-col md:items-center mt-12 mb-24 p-6 border bg-secondary/50 rounded-xl"
        >
            <h3>
                {i18n._('homepage.community')}
            </h3>
            <p class="md:max-w-3/4">{i18n._('homepage.community_description')}</p>
            <HeartHandshake size="80" class="mt-6 self-center" />
            <div class="flex flex-row flex-wrap gap-4 justify-center mt-6">
                <Button
                    variant="outline"
                    href="https://opencollective.com/gpxstudio"
                    target="_blank"
                    class="text-support text-base max-w-full h-auto whitespace-normal"
                >
                    <span>{i18n._('homepage.support_button')}</span>
                    <Heart size="16" fill="var(--support)" color="var(--support)" />
                </Button>
                <Button
                    variant="outline"
                    href="https://crowdin.com/project/gpxstudio"
                    target="_blank"
                    class="text-base max-w-full h-auto whitespace-normal"
                >
                    <Languages size="16" />
                    <span>{i18n._('homepage.translate_button')}</span>
                </Button>
            </div>
        </div>
    </div>
</div>

<style lang="postcss">
    @reference "../../app.css";

    div :global(h2) {
        @apply text-center text-4xl font-extrabold mt-24 mb-6;
    }

    div :global(h3) {
        @apply text-2xl pt-0 font-semibold mb-3;
    }

    div :global(p) {
        @apply text-muted-foreground;
    }
</style>
