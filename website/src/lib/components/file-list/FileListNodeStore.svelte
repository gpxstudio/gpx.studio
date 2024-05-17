<script lang="ts">
	import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';
	import FileListNode from '$lib/components/file-list/FileListNode.svelte';

	import type { GPXFileWithStatistics } from '$lib/db';
	import { createEventDispatcher } from 'svelte';
	import type { Readable } from 'svelte/store';

	export let file: Readable<GPXFileWithStatistics | undefined>;

	const dispatch = createEventDispatcher();

	function forwardId() {
		dispatch('click', { id: $file?.file._data.id });
	}
</script>

{#if $file}
	<CollapsibleTree side="left" margin={4} defaultState="closed">
		<FileListNode node={$file.file} id={$file.file._data.id} on:click={forwardId} />
	</CollapsibleTree>
{/if}
