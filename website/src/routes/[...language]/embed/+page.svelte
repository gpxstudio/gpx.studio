<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Embedding from '$lib/components/embedding/Embedding.svelte';
	import {
		getDefaultEmbeddingOptions,
		type EmbeddingOptions
	} from '$lib/components/embedding/Embedding';

	let embeddingOptions: EmbeddingOptions | undefined = undefined;

	onMount(() => {
		let options = $page.url.searchParams.get('options');
		if (options === null) {
			return;
		}
		options = JSON.parse(options);
		if (options === null) {
			return;
		}
		embeddingOptions = Object.assign(getDefaultEmbeddingOptions(), options);
	});
</script>

{#if embeddingOptions}
	<Embedding options={embeddingOptions} />
{/if}
