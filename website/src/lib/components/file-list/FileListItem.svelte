<script lang="ts">
	import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';
	import FileListNode from '$lib/components/file-list/FileListNode.svelte';

	import type { GPXFileWithStatistics } from '$lib/db';
	import type { Readable } from 'svelte/store';

	export let file: Readable<GPXFileWithStatistics | undefined>;
</script>

{#if $file}
	<CollapsibleTree side="left" margin={4}>
		<FileListNode node={$file.file} id={$file.file._data.id} />
	</CollapsibleTree>
{/if}
