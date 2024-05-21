<script lang="ts">
	import { Tool } from '$lib/stores';
	import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
	import Waypoint from '$lib/components/toolbar/tools/waypoint/Waypoint.svelte';
	import ToolbarItem from './ToolbarItem.svelte';
	import {
		Group,
		CalendarClock,
		Pencil,
		SquareDashedMousePointer,
		Ungroup,
		MapPin,
		Palette,
		FolderTree,
		Filter
	} from 'lucide-svelte';

	import { _ } from 'svelte-i18n';
</script>

<div class="absolute top-0 bottom-0 left-0 z-20 flex flex-col justify-center pointer-events-none">
	<div class="flex flex-row w-screen items-center">
		<div
			class="h-fit flex flex-col p-1 gap-1 bg-background rounded-md pointer-events-auto shadow-md"
		>
			<ToolbarItem tool={Tool.ROUTING}>
				<Pencil slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.routing.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.TIME}>
				<CalendarClock slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.time_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.MERGE}>
				<Group slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.merge_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.EXTRACT}>
				<Ungroup slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.extract_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.WAYPOINT}>
				<MapPin slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.waypoint_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.REDUCE}>
				<Filter slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.reduce_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.CLEAN}>
				<SquareDashedMousePointer slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.clean_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.STYLE}>
				<Palette slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.style_tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.STRUCTURE}>
				<FolderTree slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.structure_tooltip')}</span>
			</ToolbarItem>
		</div>
		<Routing />
		<Waypoint />
	</div>
</div>
