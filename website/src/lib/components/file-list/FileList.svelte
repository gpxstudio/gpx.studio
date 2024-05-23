<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListNode from './FileListNode.svelte';

	import { fileObservers } from '$lib/db';
	import { setContext } from 'svelte';
	import { ListRootItem } from './FileList';

	export let orientation: 'vertical' | 'horizontal';
	export let recursive = false;

	setContext('orientation', orientation);
	setContext('recursive', recursive);
</script>

<ScrollArea
	class={orientation === 'vertical' ? 'p-1 pr-3' : 'h-10 px-1'}
	{orientation}
	scrollbarXClasses={orientation === 'vertical' ? '' : 'mt-1 h-2'}
	scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
	<div class="flex {orientation === 'vertical' ? 'flex-col' : 'flex-row'} {$$props.class ?? ''}">
		<FileListNode bind:node={$fileObservers} item={new ListRootItem()} />
	</div>
</ScrollArea>
