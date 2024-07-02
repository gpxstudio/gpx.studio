<script lang="ts">
	import { base } from '$app/paths';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import { languages } from '$lib/languages';
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

<div class="px-10 py-6 markdown">
	<DocsLoader path="about.svx" />
</div>
