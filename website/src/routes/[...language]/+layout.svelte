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

<style lang="postcss">
	:global(.markdown) {
	}

	:global(.markdown h1) {
		@apply text-3xl;
		@apply font-bold;
		@apply mt-4 mb-2;
	}

	:global(.markdown h2) {
		@apply text-2xl;
		@apply font-bold;
		@apply mt-4 mb-2;
	}

	:global(.markdown a) {
		@apply text-blue-500;
		@apply hover:underline;
	}

	:global(.markdown ul) {
		@apply list-disc;
		@apply pl-4;
	}
</style>
