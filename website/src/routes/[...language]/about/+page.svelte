<script lang="ts">
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { languages } from '$lib/languages';
	import { Heart } from 'lucide-svelte';
	import { mode } from 'mode-watcher';
	import { _ } from 'svelte-i18n';
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

<div>
	<div class="p-12">TODO hero section</div>
	<div class="p-12">
		<div>TODO show toolbar, advanced route planning and file editing tools</div>
	</div>
	<div class="relative">
		<img src="{base}/map.png" alt="Screenshot of the gpx.studio app." class="w-full" />
		<div
			class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-background via-transparent to-background"
		/>
	</div>
	<div class="p-12">
		<div>TODO elevation profile (use component?)</div>
		<img
			src="{base}/profile-{$mode ?? 'light'}.png"
			alt="Screenshot of an elevation profile in the gpx.studio app."
			class="w-full"
		/>
	</div>
	<div class="p-12">
		<div>TODO show several squares with different basemaps of the same place</div>
	</div>
	<div class="p-12 flex flex-col gap-12">
		<div class="flex flex-col items-center gap-6">
			<DocsLoader path="about/funding.md" />
			<Button
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="w-1/3 min-w-fit bg-support text-base"
			>
				<Heart size="16" class="ml-1 mr-1" fill="rgb(var(--support))" />
				<span>{$_('homepage.support_button')}</span>
			</Button>
		</div>
		<div class="flex flex-col items-center gap-6">
			<DocsLoader path="about/translation.md" />
		</div>
		<div
			class="flex flex-col md:flex-row items-center justify-center gap-x-12 gap-y-6 p-6 mx-6 border rounded-md shadow-lg"
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
