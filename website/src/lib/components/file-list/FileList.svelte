<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListNode from './FileListNode.svelte';

	import { fileObservers } from '$lib/db';
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let selected = writable(new Set<string>());

	setContext('selected', selected);
</script>

<ScrollArea class="w-fit p-1 pr-4 border">
	<div class="w-60 flex flex-col">
		<FileListNode node={$fileObservers} id="root" />
	</div>
</ScrollArea>
