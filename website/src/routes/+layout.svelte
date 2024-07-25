<script lang="ts">
	import '../app.pcss';
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, locale, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Head from '$lib/components/Head.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { languages } from '$lib/languages';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	$: if ($page.params.language === '' && $locale !== 'en') {
		locale.set('en');
	} else if ($page.params.language) {
		let lang = $page.params.language.replace('/', '');
		if ($locale !== lang) {
			if (languages.hasOwnProperty(lang)) {
				locale.set(lang);
			} else if (browser) {
				goto(`${base}/404`);
			}
		}
	}

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
