<script lang="ts">
	import { GPXFile, Track, TrackSegment, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import CollapsibleTreeNode from '$lib/components/collapsible-tree/CollapsibleTreeNode.svelte';

	export let node: GPXTreeElement<AnyGPXTreeElement>;
	export let id: string;
	export let index: number = 0;
</script>

{#if node instanceof GPXFile}
	<CollapsibleTreeNode {id}>
		<span slot="trigger">{node.metadata.name}</span>
		<div slot="content" class="flex flex-col gap-0.5">
			{#each node.children as child, i}
				<svelte:self node={child} id={`${id}-track-${i}`} index={i} />
			{/each}
			<CollapsibleTreeNode id={`${id}-wpt`}>
				<span slot="trigger">Waypoints</span>
				<div slot="content" class="flex flex-col gap-0.5">
					{#each node.wpt as wpt, i}
						<span class="ml-1 truncate">{wpt.name ?? `Waypoint ${i + 1}`}</span>
					{/each}
				</div>
			</CollapsibleTreeNode>
		</div>
	</CollapsibleTreeNode>
{:else if node instanceof Track}
	<CollapsibleTreeNode {id}>
		<span slot="trigger" class="truncate">{node.name ?? `Track ${index + 1}`}</span>
		<div slot="content" class="flex flex-col gap-0.5">
			{#each node.children as child, i}
				<svelte:self node={child} id={`${id}-segment-${i}`} index={i} />
			{/each}
		</div>
	</CollapsibleTreeNode>
{:else if node instanceof TrackSegment}
	<span class="ml-1">
		{`Segment ${index + 1}`}
	</span>
{/if}
