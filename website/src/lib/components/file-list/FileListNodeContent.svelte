<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import Sortable from 'sortablejs/Sortable';
	import type { GPXFileWithStatistics } from '$lib/db';
	import type { Readable } from 'svelte/store';
	import FileListNodeStore from './FileListNodeStore.svelte';
	import FileListNode from './FileListNode.svelte';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let id: string;

	let container: HTMLElement;
	let sortableLevel =
		node instanceof Map
			? 'file'
			: node instanceof GPXFile
				? 'track'
				: node instanceof Track
					? 'segment'
					: 'waypoint';
	let pull: Record<string, string[]> = {
		file: ['file', 'track'],
		track: ['file', 'track'],
		segment: ['file', 'track', 'segment'],
		waypoint: ['waypoint']
	};
	let sortable: Sortable;

	onMount(() => {
		sortable = Sortable.create(container, {
			group: {
				name: sortableLevel
			},
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'Meta',
			selectedClass: 'sortable-selected',
			avoidImplicitDeselect: true
		});
	});

	function handleClick(id: string) {
		console.log('handle click for', id);
	}
</script>

<div bind:this={container} class="flex flex-col gap-0.5">
	{#if node instanceof Map}
		{#each Array.from(node.values()) as file}
			<div>
				<FileListNodeStore {file} on:click={(e) => handleClick(e.detail.id)} />
			</div>
		{/each}
	{:else if node instanceof GPXFile}
		{#each node.children as child, i}
			<div>
				<FileListNode
					node={child}
					id={`${id}-track-${i}`}
					index={i}
					on:click={(e) => handleClick(e.detail.id)}
				/>
			</div>
		{/each}
		{#if node.wpt.length > 0}
			<FileListNode node={node.wpt} id={`${id}-wpt`} on:click={(e) => handleClick(e.detail.id)} />
		{/if}
	{:else if node instanceof Track}
		{#each node.children as child, i}
			<div>
				<div>
					<Button
						variant="ghost"
						class="ml-1 truncate flex flex-row justify-start py-0 px-1 h-fit"
						on:click={() => handleClick(`${id}-seg-${i + 1}`)}>{`Segment ${i + 1}`}</Button
					>
				</div>
			</div>
		{/each}
	{:else if Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint}
		{#each node as wpt, i}
			<div>
				<div>
					<Button
						variant="ghost"
						class="ml-1 flex flex-row justify-start py-0 px-1 h-fit"
						on:click={() => handleClick(`${id}-${i + 1}`)}
						><span class="truncate">{wpt.name ?? `Waypoint ${i + 1}`}</span></Button
					>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style lang="postcss">
	div :global(.sortable-selected > * > button) {
		@apply bg-accent;
	}
</style>
