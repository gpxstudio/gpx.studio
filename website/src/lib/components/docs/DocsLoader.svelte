<script lang="ts">
	import { _, locale } from 'svelte-i18n';

	export let path: string;

	let module = undefined;

	const modules = import.meta.glob('/src/lib/docs/**/*.{md,svx}');

	$: if ($locale) {
		modules[`/src/lib/docs/${$locale}/${path}`]().then((mod) => {
			module = mod.default;
		});
	}
</script>

{#if module !== undefined}
	<div class="markdown">
		<svelte:component this={module} />
	</div>
{/if}

<style lang="postcss">
	:global(.markdown) {
	}

	:global(.markdown h1) {
		@apply text-3xl;
		@apply font-bold;
		@apply mb-3;
	}

	:global(.markdown h2) {
		@apply text-2xl;
		@apply font-bold;
		@apply mb-3;
	}

	:global(.markdown p > a) {
		@apply text-blue-500;
		@apply hover:underline;
	}

	:global(.markdown ul) {
		@apply list-disc;
		@apply pl-4;
	}

	:global(.markdown hr) {
		@apply my-5;
	}
</style>
