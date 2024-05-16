<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListItem from '$lib/components/file-list/FileListItem.svelte';

	import { fileObservers } from '$lib/db';
</script>

<ScrollArea class="w-fit p-1 pr-4">
	<div class="w-60 flex flex-col gap-1">
		{#each Array.from($fileObservers.values()) as file}
			<FileListItem {file} />
		{/each}
	</div>
</ScrollArea>
