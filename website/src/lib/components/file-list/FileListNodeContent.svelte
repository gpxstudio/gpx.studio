<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { afterUpdate, getContext, onDestroy, onMount } from 'svelte';
	import Sortable from 'sortablejs/Sortable';
	import { settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, type Readable, type Writable } from 'svelte/store';
	import FileListNodeStore from './FileListNodeStore.svelte';
	import FileListNode from './FileListNode.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let waypointRoot: boolean = false;
	export let id: string;

	let container: HTMLElement;
	let items: { [id: string | number]: HTMLElement } = {};
	let sortableLevel =
		node instanceof Map
			? 'file'
			: node instanceof GPXFile
				? waypointRoot
					? 'waypoints'
					: 'track'
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

	let orientation = getContext<'vertical' | 'horizontal'>('orientation');
	let selected = getContext<Writable<Set<string>>>('selected');

	function onSelectChange() {
		selected.update(($selected) => {
			$selected.clear();
			Object.entries(items).forEach(([id, item]) => {
				if (item.classList.contains('sortable-selected')) {
					$selected.add(id);
				}
			});
			return $selected;
		});
	}

	function syncFileOrder() {
		if (sortableLevel !== 'file') {
			return;
		}
		const currentOrder = sortable.toArray();
		if (currentOrder.length !== $fileOrder.length) {
			sortable.sort($fileOrder);
		} else {
			for (let i = 0; i < currentOrder.length; i++) {
				if (currentOrder[i] !== $fileOrder[i]) {
					sortable.sort($fileOrder);
					break;
				}
			}
		}
	}

	const { fileOrder } = settings;

	onMount(() => {
		sortable = Sortable.create(container, {
			group: {
				name: sortableLevel
			},
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'Meta',
			avoidImplicitDeselect: true,
			onSelect: onSelectChange,
			onDeselect: onSelectChange,
			sort: sortableLevel !== 'waypoint',
			onSort: () => {
				if (sortableLevel !== 'file') {
					return;
				}

				let newFileOrder = sortable.toArray();
				if (newFileOrder.length !== get(fileOrder).length) {
					fileOrder.set(newFileOrder);
					return;
				}

				for (let i = 0; i < newFileOrder.length; i++) {
					if (newFileOrder[i] !== get(fileOrder)[i]) {
						fileOrder.set(newFileOrder);
						return;
					}
				}
			}
		});
	});

	$: if ($fileOrder && sortable) {
		syncFileOrder();
	}

	afterUpdate(() => {
		syncFileOrder();
	});

	const unsubscribe = selected.subscribe(($selected) => {
		Object.entries(items).forEach(([id, item]) => {
			if ($selected.has(id) && !item.classList.contains('sortable-selected')) {
				Sortable.utils.select(item);
			} else if (!$selected.has(id) && item.classList.contains('sortable-selected')) {
				Sortable.utils.deselect(item);
			}
		});
	});

	onDestroy(() => {
		unsubscribe();
	});

	function getChildId(i: number): string {
		switch (sortableLevel) {
			case 'track':
				return `${id}-track-${i}`;
			case 'segment':
				return `${id}-seg-${i}`;
			case 'waypoint':
				return `${id}-${i}`;
		}
		return '';
	}
</script>

<div
	bind:this={container}
	class="sortable {orientation} flex {orientation === 'vertical' ? 'flex-col' : 'flex-row gap-1'}"
>
	{#if node instanceof Map}
		{#each node as [fileId, file]}
			<div bind:this={items[fileId]} data-id={fileId}>
				<FileListNodeStore {file} />
			</div>
		{/each}
	{:else if node instanceof GPXFile}
		{#if waypointRoot}
			{#if node.wpt.length > 0}
				<div bind:this={items[`${id}-wpt`]}>
					<FileListNode node={node.wpt} id={`${id}-wpt`} />
				</div>
			{/if}
		{:else}
			{#each node.children as child, i}
				<div bind:this={items[getChildId(i)]}>
					<FileListNode node={child} id={getChildId(i)} index={i} />
				</div>
			{/each}
		{/if}
	{:else if node instanceof Track}
		{#each node.children as child, i}
			<div bind:this={items[getChildId(i)]} class="ml-1">
				<div>
					<FileListNodeLabel id={getChildId(i)} label={`Segment ${i + 1}`} />
				</div>
			</div>
		{/each}
	{:else if Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint}
		{#each node as wpt, i}
			<div bind:this={items[getChildId(i)]} class="ml-1">
				<div>
					<FileListNodeLabel id={getChildId(i)} label={wpt.name ?? `Waypoint ${i + 1}`} />
				</div>
			</div>
		{/each}
	{/if}
</div>

{#if node instanceof GPXFile}
	{#if !waypointRoot}
		<svelte:self {node} {id} waypointRoot={true} />
	{/if}
{/if}

<style lang="postcss">
	.sortable > div {
		@apply rounded-md;
		@apply h-fit;
		@apply leading-none;
	}

	.vertical :global(.sortable-selected) {
		@apply bg-accent;
	}

	.horizontal :global(button) {
		@apply bg-accent;
		@apply hover:bg-background;
	}

	.horizontal :global(.sortable-selected button) {
		@apply bg-background;
	}
</style>
