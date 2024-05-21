<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
	import type { GPXFileWithStatistics } from '$lib/db';
	import type { Readable } from 'svelte/store';
	import FileListNodeContent from './FileListNodeContent.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { getContext } from 'svelte';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let id: string;
	export let index: number = 0;

	let recursive = getContext<boolean>('recursive');

	let label =
		node instanceof GPXFile
			? node.metadata.name
			: node instanceof Track
				? node.name ?? `Track ${index + 1}`
				: Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint
					? 'Waypoints'
					: '';
</script>

{#if node instanceof Map}
	<FileListNodeContent {node} {id} />
{:else if recursive}
	<CollapsibleTreeNode {id}>
		<FileListNodeLabel {id} {label} slot="trigger" />
		<div slot="content">
			<FileListNodeContent {node} {id} />
		</div>
	</CollapsibleTreeNode>
{:else}
	<FileListNodeLabel {id} {label} />
{/if}
