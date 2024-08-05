<script lang="ts">
	import '../app.pcss';
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Head from '$lib/components/Head.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const appRoutes = ['/[...language]/app', '/[...language]/embed'];

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
