<script lang="ts">
	import { reverseSelectedFiles } from '$lib/stores';
	import Routing from './Routing.svelte';
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

	let currentTool: string | null = null;
</script>

<div class="absolute top-0 bottom-0 left-0 z-10 flex flex-col justify-center pointer-events-none">
	<div class="flex flex-row w-screen items-center">
		<div
			class="h-fit flex flex-col p-1 gap-1 bg-background rounded-md pointer-events-auto shadow-md border"
		>
			<ToolbarItem
				on:click={() => {
					currentTool = currentTool === 'routing' ? null : 'routing';
				}}
			>
				<Pencil slot="icon" size="18" />
				<span slot="tooltip">Edit the track points</span>
			</ToolbarItem>
			<ToolbarItem>
				<CalendarClock slot="icon" size="18" />
				<span slot="tooltip">Change time and speed data</span>
			</ToolbarItem>
			<ToolbarItem on:click={reverseSelectedFiles}>
				<ArrowRightLeft slot="icon" size="18" />
				<span slot="tooltip">Reverse the file</span>
			</ToolbarItem>
			<ToolbarItem>
				<Group slot="icon" size="18" />
				<span slot="tooltip">Merge with another file</span>
			</ToolbarItem>
			<ToolbarItem>
				<Ungroup slot="icon" size="18" />
				<span slot="tooltip">Extract the tracks or track segments to new files</span>
			</ToolbarItem>
			<ToolbarItem>
				<MapPin slot="icon" size="18" />
				<span slot="tooltip">Create a new point of interest</span>
			</ToolbarItem>
			<ToolbarItem>
				<Shrink slot="icon" size="18" />
				<span slot="tooltip">Reduce the number of track points</span>
			</ToolbarItem>
			<ToolbarItem>
				<SquareDashedMousePointer slot="icon" size="18" />
				<span slot="tooltip"
					>Clean track points and points of interest with a rectangle selection</span
				>
			</ToolbarItem>
			<ToolbarItem>
				<Palette slot="icon" size="18" />
				<span slot="tooltip">Change the styling of the trace</span>
			</ToolbarItem>
			<ToolbarItem>
				<FolderTree slot="icon" size="18" />
				<span slot="tooltip">Manage the file structure</span>
			</ToolbarItem>
		</div>
		{#if currentTool == 'routing'}
			<Routing />
		{/if}
	</div>
</div>
