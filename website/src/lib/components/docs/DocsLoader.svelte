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
	<svelte:component this={module} />
{/if}
