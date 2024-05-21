<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { dbUtils } from '$lib/db';
	import { Copy, Trash2 } from 'lucide-svelte';

	import { _ } from 'svelte-i18n';

	import { getContext } from 'svelte';
	import { type Writable } from 'svelte/store';

	export let id: string;
	export let label: string | undefined;

	let selected = getContext<Writable<Set<string>>>('selected');
	let orientation = getContext<'vertical' | 'horizontal'>('orientation');
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<ContextMenu.Root>
	<ContextMenu.Trigger class="grow truncate">
		<Button
			variant="ghost"
			class="w-full p-0 px-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 {orientation ===
			'vertical'
				? 'h-fit'
				: 'h-9 px-1.5 shadow-md'}"
		>
			<span
				class="w-full text-left truncate py-1"
				on:click={(e) => {
					e.stopPropagation(); // Avoid toggling the collapsible element
				}}
				on:contextmenu={(e) => {
					if (e.ctrlKey) {
						// Add to selection instead of opening context menu
						e.preventDefault();
						e.stopPropagation();
						selected.update((value) => {
							if (value.has(id)) {
								value.delete(id);
							} else {
								value.add(id);
							}
							return value;
						});
					}
				}}
			>
				{label}
			</span>
		</Button>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenu.Item on:click={dbUtils.duplicateSelectedFiles}>
			<Copy size="16" class="mr-1" />
			{$_('menu.duplicate')}
			<Shortcut key="D" ctrl={true} /></ContextMenu.Item
		>
		<ContextMenu.Separator />
		<ContextMenu.Item on:click={dbUtils.deleteSelectedFiles}
			><Trash2 size="16" class="mr-1" />
			{$_('menu.delete')}
			<Shortcut key="⌫" ctrl={true} /></ContextMenu.Item
		>
	</ContextMenu.Content>
</ContextMenu.Root>
