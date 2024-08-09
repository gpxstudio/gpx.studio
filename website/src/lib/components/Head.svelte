<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { languages } from '$lib/languages';
	import { _, isLoading } from 'svelte-i18n';

	let location: string;

	$: if ($page.route.id) {
		location = $page.route.id;
		Object.keys($page.params).forEach((param) => {
			if (param !== 'language') {
				location = location.replace(`[${param}]`, $page.params[param]);
				location = location.replace(`[...${param}]`, $page.params[param]);
			}
		});
	}
</script>

<svelte:head>
	{#if $isLoading}
		<title>gpx.studio — the online GPX file editor</title>
		<meta
			name="description"
			content="View, edit and create GPX files online with advanced route planning capabilities and file processing tools, beautiful maps and detailed data visualizations."
		/>
		<meta property="og:title" content="gpx.studio — the online GPX file editor" />
		<meta
			property="og:description"
			content="View, edit and create GPX files online with advanced route planning capabilities and file processing tools, beautiful maps and detailed data visualizations."
		/>
		<meta name="twitter:title" content="gpx.studio — the online GPX file editor" />
		<meta
			name="twitter:description"
			content="View, edit and create GPX files online with advanced route planning capabilities and file processing tools, beautiful maps and detailed data visualizations."
		/>
	{:else}
		<title>gpx.studio — {$_(`metadata.${location}_title`)}</title>
		<meta name="description" content={$_('metadata.description')} />
		<meta property="og:title" content="gpx.studio — {$_(`metadata.${location}_title`)}" />
		<meta property="og:description" content={$_('metadata.description')} />
		<meta name="twitter:title" content="gpx.studio — {$_(`metadata.${location}_title`)}" />
		<meta name="twitter:description" content={$_('metadata.description')} />
	{/if}

	<meta property="og:image" content="https://gpx.studio/og_logo.png" />
	<meta property="og:url" content="https://gpx.studio/" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="gpx.studio" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://gpx.studio/og_logo.png" />
	<meta name="twitter:url" content="https://gpx.studio/" />
	<meta name="twitter:site" content="@gpxstudio" />
	<meta name="twitter:creator" content="@gpxstudio" />

	<link
		rel="alternate"
		hreflang="x-default"
		href="https://gpx.studio{base}{location.replace('/[...language]', '')}"
	/>
	{#each Object.keys(languages) as lang}
		<link
			rel="alternate"
			hreflang={lang}
			href="https://gpx.studio{base}{location.replace('[...language]', lang)}"
		/>
	{/each}
</svelte:head>
