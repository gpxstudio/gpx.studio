<script lang="ts">
	import { base } from '$app/paths';
	import { languages } from '$lib/languages';
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>gpx.studio — {$_('metadata.about_title')}</title>
	<meta name="description" content={$_('metadata.description')} />
	<meta property="og:title" content="gpx.studio — {$_('metadata.about_title')}" />
	<meta property="og:description" content={$_('metadata.description')} />
	<meta property="og:image" content="{base}/og_logo.png" />
	<meta property="og:url" content="{base}/" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="gpx.studio" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="gpx.studio — {$_('metadata.about_title')}" />
	<meta name="twitter:description" content={$_('metadata.description')} />
	<meta name="twitter:image" content="{base}/og_logo.png" />
	<meta name="twitter:url" content="{base}/" />
	<meta name="twitter:site" content="@gpxstudio" />
	<meta name="twitter:creator" content="@gpxstudio" />

	<link rel="alternate" hreflang="x-default" href="{base}/" />
	{#each Object.keys(languages) as lang}
		{#if lang === 'en'}
			<link rel="alternate" hreflang="en" href="{base}/" />
		{:else}
			<link rel="alternate" hreflang={lang} href="{base}/{lang}/" />
		{/if}
	{/each}
</svelte:head>
