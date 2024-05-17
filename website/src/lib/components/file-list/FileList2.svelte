<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListNode from './FileListNode.svelte';

	import { fileObservers } from '$lib/db';
</script>

<ScrollArea class="w-fit p-1 pr-4 border">
	<div class="w-60 flex flex-col gap-1">
		<FileListNode node={$fileObservers} id="root" />
	</div>
</ScrollArea>
