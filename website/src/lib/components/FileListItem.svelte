<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import Shortcut from './Shortcut.svelte';
	import { Copy, Trash2 } from 'lucide-svelte';

	import { get, type Readable } from 'svelte/store';
	import { selectedFiles, selectFiles } from '$lib/stores';
	import { dbUtils } from '$lib/db';

	import { _ } from 'svelte-i18n';
	import type { GPXFile } from 'gpx';

	export let file: Readable<GPXFile | undefined>;
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if $file}
	<div
		on:contextmenu={() => {
			if (!get(selectedFiles).has($file._data.id)) {
				get(selectFiles).select($file._data.id);
			}
		}}
	>
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<Button
					variant="outline"
					class="h-9 px-1.5 py-1 border-none shadow-md focus-visible:ring-0 focus-visible:ring-offset-0"
				>
					{$file.metadata.name}
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
	</div>
{/if}
