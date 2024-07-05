<script lang="ts">
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
	import { languages } from '$lib/languages';
	import { settings } from '$lib/db';
	import { BookOpenText, Heart, Map } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { exampleGPXFile } from '$lib/assets/example';
	import { writable } from 'svelte/store';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import { currentTool, Tool } from '$lib/stores';
	import { onDestroy, onMount } from 'svelte';
	import routingScreenshot from '$lib/assets/img/routing.png?enhanced';
	import mapboxOutdoorsMap from '$lib/assets/img/mapbox-outdoors.png?enhanced';
	import mapboxSatelliteMap from '$lib/assets/img/mapbox-satellite.png?enhanced';
	import ignMap from '$lib/assets/img/ign.png?enhanced';
	import cyclosmMap from '$lib/assets/img/cyclosm.png?enhanced';
	import waymarkedMap from '$lib/assets/img/waymarked.png?enhanced';
	import mapScreenshot from '$lib/assets/img/map.png?enhanced';

	let gpxStatistics = writable(exampleGPXFile.getStatistics());
	let slicedGPXStatistics = writable(undefined);
	let additionalDatasets = writable(['speed', 'atemp']);
	let elevationFill = writable<'slope' | 'surface' | undefined>(undefined);

	const { distanceUnits, velocityUnits, temperatureUnits } = settings;

	onMount(() => {
		currentTool.set(Tool.SCISSORS);
	});

	onDestroy(() => {
		currentTool.set(null);
	});
</script>

<svelte:head>
	<title>gpx.studio — {$_('metadata.about_title')}</title>
	<meta name="description" content={$_('metadata.description')} />
	<meta property="og:title" content="gpx.studio — {$_('metadata.about_title')}" />
	<meta property="og:description" content={$_('metadata.description')} />
	<meta name="twitter:title" content="gpx.studio — {$_('metadata.about_title')}" />
	<meta name="twitter:description" content={$_('metadata.description')} />

	<link rel="alternate" hreflang="x-default" href="{base}/" />
	{#each Object.keys(languages) as lang}
		{#if lang === 'en'}
			<link rel="alternate" hreflang="en" href="{base}/" />
		{:else}
			<link rel="alternate" hreflang={lang} href="{base}/{lang}/" />
		{/if}
	{/each}
</svelte:head>

<div class="flex flex-col gap-y-24 my-24">
	<div class="px-12 w-full flex flex-col items-center">
		<div class="flex flex-col gap-6 items-center max-w-3xl">
			<div class="text-6xl font-black text-center">{$_('metadata.app_title')}</div>
			<div class="text-xl text-muted-foreground text-center">
				{$_('metadata.description')}
			</div>
			<div class="w-full flex flex-row justify-center gap-3">
				<Button href="./" class="w-1/3 min-w-fit">
					<Map size="18" class="mr-1.5" />
					{$_('homepage.app')}
				</Button>
				<Button variant="secondary" href="./documentation" class="w-1/3 min-w-fit">
					<BookOpenText size="18" class="mr-1.5" />
					<span>{$_('homepage.documentation')}</span>
				</Button>
			</div>
		</div>
	</div>
	<div class="relative">
		<enhanced:img
			src={routingScreenshot}
			alt="Screenshot of the gpx.studio map in 3D."
			class="w-full"
		/>
		<div
			class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background via-transparent to-background"
		/>
	</div>
	<div class="px-24 w-full flex flex-col items-center">
		<div class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl">
			<div class="text-center [&>*>p]:text-muted-foreground">
				<DocsLoader path="about/routing.md" />
			</div>
			<div class="p-3 w-fit rounded-md border shadow-xl">
				<Routing minimizable={false} />
			</div>
		</div>
	</div>
	<div class="px-24 w-full flex flex-col items-center">
		<div class="flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl">
			<div class="text-center md:hidden [&>*>p]:text-muted-foreground">
				<DocsLoader path="about/tools.md" />
			</div>
			<div class="relative">
				<Toolbar />
			</div>
			<div class="text-center hidden md:block [&>*>p]:text-muted-foreground">
				<DocsLoader path="about/tools.md" />
			</div>
		</div>
	</div>
	<div class="px-24 w-full flex flex-col items-center">
		<div
			class="markdown flex flex-col md:flex-row gap-x-12 gap-y-6 items-center justify-between max-w-5xl"
		>
			<div class="text-center [&>*>p]:text-muted-foreground">
				<DocsLoader path="about/maps.md" />
			</div>
			<div
				class="relative grow min-w-1/2 min-h-96 aspect-square rounded-2xl shadow-xl overflow-clip"
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
	<div class="p-6 md:p-12">
		<div class="text-center mb-6 [&>*>p]:text-muted-foreground">
			<DocsLoader path="about/plot.md" />
		</div>
		<div class="flex flex-col items-center">
			<div class="h-48 w-full">
				<ElevationProfile
					{gpxStatistics}
					{slicedGPXStatistics}
					additionalDatasets={$additionalDatasets}
					elevationFill={$elevationFill}
					panelSize={200}
					distanceUnits={$distanceUnits}
					velocityUnits={$velocityUnits}
					temperatureUnits={$temperatureUnits}
				/>
			</div>
			<div class="h-10 w-fit">
				<GPXStatistics
					{gpxStatistics}
					{slicedGPXStatistics}
					panelSize={192}
					orientation={'horizontal'}
					velocityUnits={$velocityUnits}
				/>
			</div>
		</div>
	</div>
	<div class="relative">
		<enhanced:img
			src={mapScreenshot}
			alt="Screenshot of the gpx.studio map in 3D."
			class="w-full"
		/>
		<div
			class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background via-transparent to-background"
		/>
	</div>
	<div class="px-12 flex flex-col items-center">
		<div class="max-w-5xl flex flex-col items-center gap-6">
			<DocsLoader path="about/funding.md" />
			<Button
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="w-1/3 min-w-fit bg-support text-base"
			>
				<Heart size="16" class="mr-1" fill="rgb(var(--support))" />
				<span>{$_('homepage.support_button')}</span>
			</Button>
		</div>
	</div>
	<div class="px-12 flex flex-col items-center">
		<div class="max-w-5xl">
			<DocsLoader path="about/translation.md" />
		</div>
	</div>
	<div class="px-24 flex flex-col items-center">
		<div
			class="max-w-4xl flex flex-col md:flex-row items-center justify-center gap-x-12 gap-y-6 p-6 border rounded-2xl shadow-xl"
		>
			<div class="shrink-0 flex flex-col sm:flex-row md:flex-col items-center gap-x-4 gap-y-2">
				<div class="text-lg font-semibold text-muted-foreground">
					❤️ {$_('homepage.supported_by')}
				</div>
				<a href="https://www.mapbox.com/" target="_blank">
					<Logo company="mapbox" class="w-60" />
				</a>
			</div>
			<DocsLoader path="about/mapbox.md" />
		</div>
	</div>
</div>
