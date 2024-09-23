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
		Scissors,
		MountainSnow
	} from 'lucide-svelte';

	import { _ } from 'svelte-i18n';
	import ToolbarItemMenu from './ToolbarItemMenu.svelte';
</script>

<div class="flex flex-row w-full items-center pr-12">
	<div
		class="h-fit flex flex-col p-1 gap-1.5 bg-background rounded-r-md pointer-events-auto shadow-md {$$props.class ??
			''}"
	>
		<ToolbarItem tool={Tool.ROUTING} label={$_('toolbar.routing.tooltip')}>
			<Pencil slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.WAYPOINT} label={$_('toolbar.waypoint.tooltip')}>
			<MapPin slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.SCISSORS} label={$_('toolbar.scissors.tooltip')}>
			<Scissors slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.TIME} label={$_('toolbar.time.tooltip')}>
			<CalendarClock slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.MERGE} label={$_('toolbar.merge.tooltip')}>
			<Group slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.EXTRACT} label={$_('toolbar.extract.tooltip')}>
			<Ungroup slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.ELEVATION} label={$_('toolbar.elevation.button')}>
			<MountainSnow slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.REDUCE} label={$_('toolbar.reduce.tooltip')}>
			<Filter slot="icon" size="18" />
		</ToolbarItem>
		<ToolbarItem tool={Tool.CLEAN} label={$_('toolbar.clean.tooltip')}>
			<SquareDashedMousePointer slot="icon" size="18" />
		</ToolbarItem>
	</div>
	<ToolbarItemMenu class={$$props.class ?? ''} />
</div>
