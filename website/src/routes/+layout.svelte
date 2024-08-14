<script lang="ts">
	import '../app.pcss';
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Head from '$lib/components/Head.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { onMount } from 'svelte';
	import { convertOldEmbeddingOptions } from '$lib/components/embedding/Embedding';

	const appRoutes = ['/[[language]]/app', '/[[language]]/embed'];

	onMount(() => {
		if ($page.url.searchParams.has('embed')) {
			// convert old embedding options to new format and redirect to new embed page
			let locale = $page.params.language;
			window.location.href = `${locale ? '/' + locale : ''}/embed?options=${encodeURIComponent(JSON.stringify(convertOldEmbeddingOptions($page.url.searchParams)))}`;
		}
	});

	$: showNavAndFooter = $page.route.id === null || !appRoutes.includes($page.route.id);
</script>

<Head />
<ModeWatcher />

<div class="flex flex-col min-h-screen">
	{#if !$isLoading}
		{#if showNavAndFooter}
			<Nav />
		{/if}
		<main class="grow flex flex-col">
			<slot />
		</main>
		{#if showNavAndFooter}
			<Footer />
		{/if}
	{/if}
</div>
