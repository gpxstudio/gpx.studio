<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
	import { settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, type Readable } from 'svelte/store';
	import FileListNodeContent from './FileListNodeContent.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { getContext, onDestroy } from 'svelte';
	import { type ListItem, type ListTrackItem } from './FileList';
	import { _ } from 'svelte-i18n';
	import { selection } from './Selection';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let item: ListItem;

	let recursive = getContext<boolean>('recursive');

	let collapsible: CollapsibleTreeNode;

	$: label =
		node instanceof GPXFile
			? node.metadata.name
			: node instanceof Track
				? node.name ?? `${$_('gpx.track')} ${(item as ListTrackItem).trackIndex + 1}`
				: Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint
					? $_('gpx.waypoints')
					: '';

	const { verticalFileView } = settings;
	const unsubscribe = selection.subscribe(($selection) => {
		if (collapsible && get(verticalFileView) && $selection.hasAnyChildren(item, false)) {
			collapsible.openNode();
		}
	});

	onDestroy(() => {
		unsubscribe();
	});
</script>

{#if node instanceof Map}
	<FileListNodeContent {node} {item} />
{:else if recursive}
	<CollapsibleTreeNode id={item.getId()} bind:this={collapsible}>
		<FileListNodeLabel {item} {label} slot="trigger" />
		<div slot="content">
			<FileListNodeContent {node} {item} />
		</div>
	</CollapsibleTreeNode>
{:else}
	<FileListNodeLabel {item} {label} />
{/if}
