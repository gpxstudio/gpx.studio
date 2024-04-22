<script lang="ts">
	import GPX from './GPX.svelte';

	import { fileCollection } from '$lib/stores';
</script>

{#each $fileCollection.files as file}
	<GPX {file} />
{/each}
