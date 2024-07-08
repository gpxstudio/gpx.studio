<script lang="ts">
	import App from '$lib/components/App.svelte';
	import { base } from '$app/paths';
	import { languages } from '$lib/languages';
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>gpx.studio — {$_('metadata.app_title')}</title>
	<meta name="description" content={$_('metadata.description')} />
	<meta property="og:title" content="gpx.studio — {$_('metadata.app_title')}" />
	<meta property="og:description" content={$_('metadata.description')} />
	<meta name="twitter:title" content="gpx.studio — {$_('metadata.app_title')}" />
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

<App />
