<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import FileListNode from './FileListNode.svelte';
	import { fileObservers, settings } from '$lib/db';
	import { setContext } from 'svelte';
	import { ListFileItem, ListLevel, ListRootItem, allowedPastes } from './FileList';
	import { copied, pasteSelection, selectAll, selection } from './Selection';
	import { ClipboardPaste, FileStack, Plus } from 'lucide-svelte';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { _ } from 'svelte-i18n';
	import { createFile } from '$lib/stores';

	export let orientation: 'vertical' | 'horizontal';
	export let recursive = false;

	setContext('orientation', orientation);
	setContext('recursive', recursive);

	const { treeFileView } = settings;

	treeFileView.subscribe(($vertical) => {
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
	class="shrink-0 {orientation === 'vertical' ? 'p-0 pr-3' : 'h-10 px-1'}"
	{orientation}
	scrollbarXClasses={orientation === 'vertical' ? '' : 'mt-1 h-2'}
	scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
	<div
		class="flex {orientation === 'vertical'
			? 'flex-col py-1 pl-1 min-h-screen'
			: 'flex-row'} {$$props.class ?? ''}"
		{...$$restProps}
	>
		<FileListNode bind:node={$fileObservers} item={new ListRootItem()} />
		{#if orientation === 'vertical'}
			<ContextMenu.Root>
				<ContextMenu.Trigger class="grow" />
				<ContextMenu.Content>
					<ContextMenu.Item on:click={createFile}>
						<Plus size="16" class="mr-1" />
						{$_('menu.new_file')}
						<Shortcut key="+" ctrl={true} />
					</ContextMenu.Item>
					<ContextMenu.Separator />
					<ContextMenu.Item on:click={selectAll} disabled={$fileObservers.size === 0}>
						<FileStack size="16" class="mr-1" />
						{$_('menu.select_all')}
						<Shortcut key="A" ctrl={true} />
					</ContextMenu.Item>
					<ContextMenu.Separator />
					<ContextMenu.Item
						disabled={$copied === undefined ||
							$copied.length === 0 ||
							!allowedPastes[$copied[0].level].includes(ListLevel.ROOT)}
						on:click={pasteSelection}
					>
						<ClipboardPaste size="16" class="mr-1" />
						{$_('menu.paste')}
						<Shortcut key="V" ctrl={true} />
					</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		{/if}
	</div>
</ScrollArea>
