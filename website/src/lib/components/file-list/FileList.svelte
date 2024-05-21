<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListNode from './FileListNode.svelte';

	import { fileObservers } from '$lib/db';
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let orientation: 'vertical' | 'horizontal';
	export let recursive = false;
	export let selected = writable(new Set<string>());

	setContext('orientation', orientation);
	setContext('recursive', recursive);
	setContext('selected', selected);
</script>

<ScrollArea
	class={orientation === 'vertical' ? 'p-1 pr-3 border-l' : 'h-10 px-1'}
	{orientation}
	scrollbarXClasses={orientation === 'vertical' ? '' : 'mt-1 h-2'}
	scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
	<div class="flex {orientation === 'vertical' ? 'flex-col' : 'flex-row'} {$$props.class ?? ''}">
		<FileListNode node={$fileObservers} id="root" />
	</div>
</ScrollArea>
