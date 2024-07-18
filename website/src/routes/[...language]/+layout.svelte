<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, locale, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Head from '$lib/components/Head.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	$: if ($page.params.language === '' && $locale !== 'en') {
		locale.set('en');
	} else if ($page.params.language && $locale !== $page.params.language) {
		locale.set($page.params.language.replace('/', ''));
	}

	const appRoutes = ['/[...language]/app', '/[...language]/embed'];

	$: showNavAndFooter = $page.route.id === null || !appRoutes.includes($page.route.id);
</script>

<Head />
<ModeWatcher />

{#if !$isLoading}
	{#if showNavAndFooter}
		<Nav />
	{/if}
	<main>
		<slot />
	</main>
	{#if showNavAndFooter}
		<Footer />
	{/if}
{/if}
