<script lang="ts">
	import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';
	import FileListNode from '$lib/components/file-list/FileListNode.svelte';

	import type { GPXFileWithStatistics } from '$lib/db';
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	export let file: Readable<GPXFileWithStatistics | undefined>;

	let recursive = getContext<boolean>('recursive');
</script>

{#if $file}
	{#if recursive}
		<CollapsibleTree side="left" margin={4} defaultState="closed">
			<FileListNode node={$file.file} id={$file.file._data.id} />
		</CollapsibleTree>
	{:else}
		<FileListNode node={$file.file} id={$file.file._data.id} />
	{/if}
{/if}
