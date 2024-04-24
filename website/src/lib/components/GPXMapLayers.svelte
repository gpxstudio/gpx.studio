<script lang="ts">
	import GPXMapLayer from './GPXMapLayer.svelte';

	import { files } from '$lib/stores';
</script>

{#each $files as file}
	<GPXMapLayer {file} />
{/each}
