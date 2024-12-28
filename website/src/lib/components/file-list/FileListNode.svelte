<script lang="ts">
	import {
		GPXFile,
		Track,
		TrackSegment,
		Waypoint,
		type AnyGPXTreeElement,
		type GPXTreeElement
	} from 'gpx';
	import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
	import { settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, type Readable } from 'svelte/store';
	import FileListNodeContent from './FileListNodeContent.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { afterUpdate, getContext } from 'svelte';
	import {
		ListFileItem,
		ListTrackSegmentItem,
		ListWaypointItem,
		ListWaypointsItem,
		type ListItem,
		type ListTrackItem
	} from './FileList';
	import { _ } from 'svelte-i18n';
	import { selection } from './Selection';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| Waypoint[]
		| Waypoint;
	export let item: ListItem;

	let recursive = getContext<boolean>('recursive');

	let collapsible: CollapsibleTreeNode;

	$: label =
		node instanceof GPXFile && item instanceof ListFileItem
			? node.metadata.name
			: node instanceof Track
				? (node.name ?? `${$_('gpx.track')} ${(item as ListTrackItem).trackIndex + 1}`)
				: node instanceof TrackSegment
					? `${$_('gpx.segment')} ${(item as ListTrackSegmentItem).segmentIndex + 1}`
					: node instanceof Waypoint
						? (node.name ?? `${$_('gpx.waypoint')} ${(item as ListWaypointItem).waypointIndex + 1}`)
						: node instanceof GPXFile && item instanceof ListWaypointsItem
							? $_('gpx.waypoints')
							: '';

	const { treeFileView } = settings;

	function openIfSelectedChild() {
		if (collapsible && get(treeFileView) && $selection.hasAnyChildren(item, false)) {
			collapsible.openNode();
		}
	}

	if ($selection) {
		openIfSelectedChild();
	}

	afterUpdate(openIfSelectedChild);
</script>

{#if node instanceof Map}
	<FileListNodeContent {node} {item} />
{:else if node instanceof TrackSegment}
	<FileListNodeLabel {node} {item} {label} />
{:else if node instanceof Waypoint}
	<FileListNodeLabel {node} {item} {label} />
{:else if recursive}
	<CollapsibleTreeNode id={item.getId()} bind:this={collapsible}>
		<FileListNodeLabel {node} {item} {label} slot="trigger" />
		<div slot="content" class="ml-2">
			{#key node}
				<FileListNodeContent {node} {item} />
			{/key}
		</div>
	</CollapsibleTreeNode>
{:else}
	<FileListNodeLabel {node} {item} {label} />
{/if}
