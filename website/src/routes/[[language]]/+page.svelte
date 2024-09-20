<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import DocsContainer from '$lib/components/docs/DocsContainer.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
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
		Scale
	} from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';
	import { getURLForLanguage } from '$lib/utils';
	import { exampleGPXFile } from '$lib/assets/example';
	import { writable } from 'svelte/store';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import { currentTool, Tool } from '$lib/stores';
	import { onDestroy, onMount } from 'svelte';
	import routingScreenshot from '$lib/assets/img/home/routing.png?enhanced';
	import mapboxOutdoorsMap from '$lib/assets/img/home/mapbox-outdoors.png?enhanced';
	import mapboxSatelliteMap from '$lib/assets/img/home/mapbox-satellite.png?enhanced';
	import ignMap from '$lib/assets/img/home/ign.png?enhanced';
	import cyclosmMap from '$lib/assets/img/home/cyclosm.png?enhanced';
	import waymarkedMap from '$lib/assets/img/home/waymarked.png?enhanced';
	import mapScreenshot from '$lib/assets/img/home/map.png?enhanced';

	export let data: {
		fundingModule: any;
		translationModule: any;
		mapboxModule: any;
	};

	let gpxStatistics = writable(exampleGPXFile.getStatistics());
	let slicedGPXStatistics = writable(undefined);
	let additionalDatasets = writable(['speed', 'atemp']);
	let elevationFill = writable<'slope' | 'surface' | undefined>(undefined);

	onMount(() => {
		$currentTool = Tool.SCISSORS;
	});

	$: $currentTool, ($currentTool = Tool.SCISSORS);

	onDestroy(() => {
		$currentTool = null;
	});
</script>

<div class="space-y-24 my-24">
	<div class="-mt-12 sm:mt-0">
		<div class="px-12 w-full flex flex-col items-center">
			<div class="flex flex-col gap-6 items-center max-w-3xl">
				<div class="text-4xl sm:text-6xl font-black text-center">{$_('metadata.app_title')}</div>
				<div class="text-lg sm:text-xl text-muted-foreground text-center">
					{$_('metadata.description')}
				</div>
				<div class="w-full flex flex-row justify-center gap-3">
					<Button href={getURLForLanguage($locale, '/app')} class="w-1/3 min-w-fit">
						<Map size="18" class="mr-1.5" />
						{$_('homepage.app')}
					</Button>
					<Button
						variant="secondary"
						href={getURLForLanguage($locale, '/help')}
						class="w-1/3 min-w-fit"
					>
						<BookOpenText size="18" class="mr-1.5" />
						<span>{$_('menu.help')}</span>
					</Button>
				</div>
			</div>
		</div>
		<div class="relative overflow-hidden">
			<enhanced:img
				src={routingScreenshot}
				alt="Screenshot of the gpx.studio map in 3D."
				class="w-full min-w-[1200px] ml-[20%] -translate-x-[20%]"
			/>
			<div
				class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background via-transparent to-background"
			/>
		</div>
	</div>
	<div class="px-12 sm:px-24 w-full flex flex-col items-center">
		<div class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl">
			<div class="markdown text-center">
				<h1>
					<Route size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.route_planning')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.route_planning_description')}</p>
			</div>
			<div class="p-3 w-fit rounded-md border shadow-xl md:shrink-0">
				<Routing minimizable={false} />
			</div>
		</div>
	</div>
	<div class="px-12 sm:px-24 w-full flex flex-col items-center">
		<div class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl">
			<div class="markdown text-center md:hidden">
				<h1>
					<PencilRuler size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.file_processing')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.file_processing_description')}</p>
			</div>
			<div class="relative md:shrink-0 max-w-[400px]">
				<Toolbar />
			</div>
			<div class="markdown text-center hidden md:block">
				<h1>
					<PencilRuler size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.file_processing')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.file_processing_description')}</p>
			</div>
		</div>
	</div>
	<div class="px-12 sm:px-24 w-full flex flex-col items-center">
		<div
			class="markdown flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl"
		>
			<div class="markdown text-center">
				<h1>
					<Map size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.maps')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.maps_description')}</p>
			</div>
			<div
				class="relative h-60 xs:h-80 aspect-square rounded-2xl shadow-xl overflow-hidden overflow-clip"
			>
				<enhanced:img
					src={mapboxOutdoorsMap}
					alt="Mapbox Outdoors map screenshot."
					class="absolute"
					style="clip-path: inset(0 50% 50% 0);"
				/>
				<enhanced:img
					src={mapboxSatelliteMap}
					alt="Mapbox Satellite map screenshot."
					class="absolute"
					style="clip-path: inset(0 0 50% 50%);"
				/>
				<enhanced:img
					src={ignMap}
					alt="IGN map screenshot."
					class="absolute"
					style="clip-path: inset(50% 50% 0 0);"
				/>
				<enhanced:img
					src={cyclosmMap}
					alt="CyclOSM map screenshot."
					class="absolute"
					style="clip-path: inset(50% 0 0 50%);"
				/>
				<enhanced:img src={waymarkedMap} alt="Waymarked Trails map screenshot." class="absolute" />
			</div>
		</div>
	</div>
	<div class="px-8 md:px-12">
		<div class="markdown text-center px-4 md:px-12">
			<h1>
				<ChartArea size="24" class="mr-1 inline-block align-baseline" />
				{$_('homepage.data_visualization')}
			</h1>
			<p class="text-muted-foreground mb-6">{$_('homepage.data_visualization_description')}</p>
		</div>
		<div class="h-48 w-full">
			<ElevationProfile
				{gpxStatistics}
				{slicedGPXStatistics}
				additionalDatasets={$additionalDatasets}
				elevationFill={$elevationFill}
				panelSize={200}
			/>
		</div>
		<div class="flex flex-col items-center">
			<div class="h-10 w-fit">
				<GPXStatistics
					{gpxStatistics}
					{slicedGPXStatistics}
					panelSize={192}
					orientation={'horizontal'}
				/>
			</div>
		</div>
	</div>
	<div class="px-12 sm:px-24 w-full flex flex-col items-center">
		<div class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl">
			<div class="markdown text-center md:hidden">
				<h1>
					<Scale size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.identity')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.identity_description')}</p>
			</div>
			<a href="https://github.com/gpxstudio/gpx.studio" target="_blank">
				<Logo class="h-32" company="github" />
			</a>
			<div class="markdown text-center hidden md:block">
				<h1>
					<Scale size="24" class="mr-1 inline-block align-baseline" />
					{$_('homepage.identity')}
				</h1>
				<p class="text-muted-foreground">{$_('homepage.identity_description')}</p>
			</div>
		</div>
	</div>
	<div class="px-12 w-full">
		<div class="w-full max-w-7xl mx-auto rounded-2xl shadow-xl overflow-hidden overflow-clip">
			<enhanced:img
				src={mapScreenshot}
				alt="Screenshot of the gpx.studio map in 3D."
				class="min-w-[800px] ml-[15%] -translate-x-[15%]"
			/>
		</div>
	</div>
	<div
		class="px-12 md:px-24 flex flex-row flex-wrap lg:flex-nowrap items-center justify-center -space-y-0.5 lg:-space-x-0.5"
	>
		<div
			class="grow max-w-xl flex flex-col items-center gap-6 p-8 border rounded-2xl shadow-xl -rotate-1 lg:rotate-1"
		>
			{#await data.fundingModule then fundingModule}
				<DocsContainer module={fundingModule.default} />
			{/await}
			<Button href="https://ko-fi.com/gpxstudio" target="_blank" class="text-base">
				<Heart size="16" class="mr-1" fill="rgb(var(--support))" color="rgb(var(--support))" />
				<span>{$_('homepage.support_button')}</span>
			</Button>
		</div>
		<div
			class="grow max-w-lg mx-6 h-fit bg-background flex flex-col items-center gap-6 p-8 border rounded-2xl shadow-xl rotate-1 lg:-rotate-1"
		>
			{#await data.translationModule then translationModule}
				<DocsContainer module={translationModule.default} />
			{/await}
			<Button href="https://crowdin.com/project/gpxstudio" target="_blank" class="text-base">
				<PenLine size="16" class="mr-1" />
				<span>{$_('homepage.contribute')}</span>
			</Button>
		</div>
	</div>
	<div class="px-12 md:px-24 flex flex-col items-center">
		<div
			class="max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-x-12 gap-y-6 p-6 border rounded-2xl shadow-xl bg-muted"
		>
			<div class="shrink-0 flex flex-col sm:flex-row lg:flex-col items-center gap-x-4 gap-y-2">
				<div class="text-lg font-semibold text-muted-foreground">
					❤️ {$_('homepage.supported_by')}
				</div>
				<a href="https://www.mapbox.com/" target="_blank">
					<Logo company="mapbox" class="w-60" />
				</a>
			</div>
			{#await data.mapboxModule then mapboxModule}
				<DocsContainer module={mapboxModule.default} />
			{/await}
		</div>
	</div>
</div>
