<script lang="ts">
	import { Tool } from '$lib/stores';
	import ToolbarItem from './ToolbarItem.svelte';
	import {
		Group,
		CalendarClock,
		Pencil,
		SquareDashedMousePointer,
		Ungroup,
		MapPin,
		Filter,
		Scissors
	} from 'lucide-svelte';

	import { _ } from 'svelte-i18n';
	import ToolbarItemMenu from './ToolbarItemMenu.svelte';
</script>

<div class="absolute top-0 bottom-0 left-0 z-20 flex flex-col justify-center pointer-events-none">
	<div class="flex flex-row w-screen items-center">
		<div
			class="h-fit flex flex-col p-1 gap-1.5 bg-background rounded-r-md pointer-events-auto shadow-md"
		>
			<ToolbarItem tool={Tool.ROUTING}>
				<Pencil slot="icon" size="18" class="h-" />
				<span slot="tooltip">{$_('toolbar.routing.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.WAYPOINT}>
				<MapPin slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.waypoint.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.SCISSORS}>
				<Scissors slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.scissors.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.TIME}>
				<CalendarClock slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.time.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.MERGE}>
				<Group slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.merge.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.EXTRACT}>
				<Ungroup slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.extract.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.REDUCE}>
				<Filter slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.reduce.tooltip')}</span>
			</ToolbarItem>
			<ToolbarItem tool={Tool.CLEAN}>
				<SquareDashedMousePointer slot="icon" size="18" />
				<span slot="tooltip">{$_('toolbar.clean.tooltip')}</span>
			</ToolbarItem>
		</div>
		<ToolbarItemMenu />
	</div>
</div>
