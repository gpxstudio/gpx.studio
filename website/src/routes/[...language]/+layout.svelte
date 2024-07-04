<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, locale, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';

	$: if ($page.params.language === '' && $locale !== 'en') {
		locale.set('en');
	} else if ($page.params.language && $locale !== $page.params.language) {
		locale.set($page.params.language);
	}

	const appRoute = '/[...language]';
</script>

<ModeWatcher />

{#if !$isLoading}
	{#if $page.route.id === appRoute}
		<slot />
	{:else}
		<Nav />
		<main>
			<slot />
		</main>
		<Footer />
	{/if}
{/if}
