<script lang="ts">
	import GPX from './GPX.svelte';

	import { files } from '$lib/stores';
</script>

{#each $files as file}
	<GPX {file} />
{/each}
