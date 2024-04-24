<script lang="ts">
	import { reverseSelectedFiles } from '$lib/stores';
	import Routing from './routing/Routing.svelte';
	import ToolbarItem from './ToolbarItem.svelte';
	import {
		ArrowRightLeft,
		Group,
		CalendarClock,
		Pencil,
		SquareDashedMousePointer,
		Ungroup,
		MapPin,
		Shrink,
		Palette,
		FolderTree
	} from 'lucide-svelte';

	import { _ } from 'svelte-i18n';

	let currentTool: string | null = null;

	function getToggleTool(tool: string) {
		return () => toggleTool(tool);
	}

	function toggleTool(tool: string) {
		currentTool = currentTool === tool ? null : tool;
	}
</script>

<div class="absolute top-0 bottom-0 left-0 z-10 flex flex-col justify-center pointer-events-none">
	<div class="flex flex-row w-screen items-center">
		<div
			class="h-fit flex flex-col p-1 gap-1 bg-background rounded-md pointer-events-auto shadow-md border"
		>
			<ToolbarItem on:click={getToggleTool('routing')}>
				<Pencil slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.routing.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<CalendarClock slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.time_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem on:click={reverseSelectedFiles}>
				<ArrowRightLeft slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.reverse_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<Group slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.merge_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<Ungroup slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.extract_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<MapPin slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.waypoint_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<Shrink slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.reduce_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<SquareDashedMousePointer slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.clean_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<Palette slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.style_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem>
				<FolderTree slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.structure_tooltip')}</span>
			</ToolbarItem>
		</div>
		{#if currentTool == 'routing'}
			<Routing />
		{/if}
	</div>
</div>
