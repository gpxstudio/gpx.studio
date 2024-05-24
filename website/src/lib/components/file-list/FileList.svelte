<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import FileListNode from './FileListNode.svelte';

	import { fileObservers, settings } from '$lib/db';
	import { setContext } from 'svelte';
	import { ListFileItem, ListRootItem } from './FileList';
	import { selection } from './Selection';

	export let orientation: 'vertical' | 'horizontal';
	export let recursive = false;

	setContext('orientation', orientation);
	setContext('recursive', recursive);

	const { verticalFileView } = settings;

	verticalFileView.subscribe(($vertical) => {
		if ($vertical) {
			selection.update(($selection) => {
				$selection.forEach((item) => {
					if ($selection.hasAnyChildren(item, false)) {
						$selection.toggle(item);
					}
				});
				return $selection;
			});
		} else {
			selection.update(($selection) => {
				$selection.forEach((item) => {
					if (!(item instanceof ListFileItem)) {
						$selection.toggle(item);
						$selection.set(new ListFileItem(item.getFileId()), true);
					}
				});
				return $selection;
			});
		}
	});
</script>

<ScrollArea
	class="shrink-0 {orientation === 'vertical' ? 'p-1 pr-3' : 'h-10 px-1'}"
	{orientation}
	scrollbarXClasses={orientation === 'vertical' ? '' : 'mt-1 h-2'}
	scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
	<div class="flex {orientation === 'vertical' ? 'flex-col' : 'flex-row'} {$$props.class ?? ''}">
		<FileListNode bind:node={$fileObservers} item={new ListRootItem()} />
	</div>
</ScrollArea>
