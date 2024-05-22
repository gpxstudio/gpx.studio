<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
	import type { GPXFileWithStatistics } from '$lib/db';
	import type { Readable } from 'svelte/store';
	import FileListNodeContent from './FileListNodeContent.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { getContext } from 'svelte';
	import { type ListItem, type ListTrackItem } from './FileList';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let item: ListItem;

	let recursive = getContext<boolean>('recursive');

	let label =
		node instanceof GPXFile
			? node.metadata.name
			: node instanceof Track
				? node.name ?? `Track ${(item as ListTrackItem).trackIndex + 1}`
				: Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint
					? 'Waypoints'
					: '';
</script>

{#if node instanceof Map}
	<FileListNodeContent {node} {item} />
{:else if recursive}
	<CollapsibleTreeNode id={item.getId()}>
		<FileListNodeLabel {item} {label} slot="trigger" />
		<div slot="content">
			<FileListNodeContent {node} {item} />
		</div>
	</CollapsibleTreeNode>
{:else}
	<FileListNodeLabel {item} {label} />
{/if}
