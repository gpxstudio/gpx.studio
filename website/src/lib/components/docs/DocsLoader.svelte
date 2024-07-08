<script lang="ts">
	import { _, locale } from 'svelte-i18n';

	export let path: string;
	export let titleOnly: boolean = false;

	let module = undefined;
	let metadata: Record<string, any> = {};

	const modules = import.meta.glob('/src/lib/docs/**/*.{md,svx}');

	function loadModule(path: string) {
		modules[path]().then((mod) => {
			module = mod.default;
			metadata = mod.metadata;
		});
	}

	$: if ($locale) {
		loadModule(`/src/lib/docs/${$locale}/${path}`);
	}
</script>

{#if module !== undefined}
	{#if titleOnly}
		{metadata.title}
	{:else}
		<div class="markdown space-y-3">
			<svelte:component this={module} />
		</div>
	{/if}
{/if}

<style lang="postcss">
	:global(.markdown) {
	}

	:global(.markdown h1) {
		@apply text-3xl;
		@apply font-semibold;
		@apply mb-6;
	}

	:global(.markdown h2) {
		@apply text-2xl;
		@apply font-semibold;
		@apply mb-3;
	}

	:global(.markdown p > a) {
		@apply text-blue-500;
		@apply hover:underline;
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
