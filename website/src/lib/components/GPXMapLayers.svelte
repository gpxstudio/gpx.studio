<script lang="ts">
	import GPXMapLayer from './GPXMapLayer.svelte';

	import { fileCollection } from '$lib/stores';
</script>

{#each $fileCollection.files as file}
	<GPXMapLayer {file} />
{/each}
