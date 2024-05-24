<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { dbUtils, fileObservers } from '$lib/db';
	import { Copy, MapPin, Trash2, Waypoints } from 'lucide-svelte';
	import { ListLevel, ListWaypointItem, type ListItem } from './FileList';
	import { selectItem, selection } from './Selection';
	import { _ } from 'svelte-i18n';
	import { getContext } from 'svelte';
	import { get } from 'svelte/store';
	import { gpxLayers } from '$lib/stores';

	export let item: ListItem;
	export let label: string | undefined;

	let orientation = getContext<'vertical' | 'horizontal'>('orientation');
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<ContextMenu.Root
	onOpenChange={(open) => {
		if (open && !get(selection).has(item)) {
			selectItem(item);
		}
	}}
>
	<ContextMenu.Trigger class="grow truncate">
		<Button
			variant="ghost"
			class="w-full p-0 px-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 {orientation ===
			'vertical'
				? 'h-fit'
				: 'h-9 px-1.5 shadow-md'}"
		>
			<span
				class="w-full text-left truncate py-1 flex flex-row items-center"
				on:click={(e) => {
					e.stopPropagation(); // Avoid toggling the collapsible element
				}}
				on:contextmenu={(e) => {
					if (e.ctrlKey) {
						// Add to selection instead of opening context menu
						e.preventDefault();
						e.stopPropagation();
						$selection.toggle(item);
					}
				}}
				on:mouseenter={() => {
					if (item instanceof ListWaypointItem) {
						let layer = get(gpxLayers).get(item.getFileId());
						let fileStore = get(fileObservers).get(item.getFileId());
						if (layer && fileStore) {
							let waypoint = get(fileStore)?.file.wpt[item.getWaypointIndex()];
							if (waypoint) {
								layer.showWaypointPopup(waypoint);
							}
						}
					}
				}}
				on:mouseleave={() => {
					if (item instanceof ListWaypointItem) {
						let layer = get(gpxLayers).get(item.getFileId());
						if (layer) {
							layer.hideWaypointPopup();
						}
					}
				}}
			>
				{#if item.level === ListLevel.SEGMENT}
					<Waypoints size="16" class="mr-1 shrink-0" />
				{:else if item.level === ListLevel.WAYPOINT}
					<MapPin size="16" class="mr-1 shrink-0" />
				{/if}
				<span class="grow truncate">
					{label}
				</span>
			</span>
		</Button>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if item.level !== ListLevel.WAYPOINTS}
			<ContextMenu.Item on:click={dbUtils.duplicateSelection}>
				<Copy size="16" class="mr-1" />
				{$_('menu.duplicate')}
				<Shortcut key="D" ctrl={true} /></ContextMenu.Item
			>
			<ContextMenu.Separator />
		{/if}
		<ContextMenu.Item on:click={dbUtils.deleteSelection}
			><Trash2 size="16" class="mr-1" />
			{$_('menu.delete')}
			<Shortcut key="⌫" ctrl={true} /></ContextMenu.Item
		>
	</ContextMenu.Content>
</ContextMenu.Root>
