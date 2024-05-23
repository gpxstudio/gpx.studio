<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { afterUpdate, getContext, onDestroy, onMount } from 'svelte';
	import Sortable from 'sortablejs/Sortable';
	import { fileObservers, settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, type Readable } from 'svelte/store';
	import FileListNodeStore from './FileListNodeStore.svelte';
	import FileListNode from './FileListNode.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { type ListItem } from './FileList';
	import { selection } from './Selection';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let item: ListItem;
	export let waypointRoot: boolean = false;

	let container: HTMLElement;
	let elements: { [id: string | number]: HTMLElement } = {};
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

	function onSelectChange() {
		selection.update(($selection) => {
			$selection.clear();
			Object.entries(elements).forEach(([id, element]) => {
				let realId = sortableLevel === 'file' || sortableLevel === 'waypoints' ? id : parseInt(id);
				$selection.set(item.extend(realId), element.classList.contains('sortable-selected'));
			});
			return $selection;
		});
	}

	const { fileOrder } = settings;
	function syncFileOrder() {
		if (!sortable || sortableLevel !== 'file') {
			return;
		}

		if ($fileOrder.length !== $fileObservers.size) {
			// Files were added or removed
			fileOrder.update((order) => {
				for (let i = 0; i < order.length; ) {
					if (!$fileObservers.has(order[i])) {
						order.splice(i, 1);
					} else {
						i++;
					}
				}
				for (let id of $fileObservers.keys()) {
					if (!order.includes(id)) {
						order.push(id);
					}
				}
				return order;
			});
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

	$: if ($fileOrder) {
		syncFileOrder();
	}

	afterUpdate(() => {
		if (sortableLevel === 'file') {
			syncFileOrder();
			Object.keys(elements).forEach((fileId) => {
				if (!get(fileObservers).has(fileId)) {
					delete elements[fileId];
				}
			});
		}
	});

	const unsubscribe = selection.subscribe(($selection) => {
		Object.entries(elements).forEach(([id, element]) => {
			let realId = sortableLevel === 'file' || sortableLevel === 'waypoints' ? id : parseInt(id);
			let inSelection = $selection.has(item.extend(realId));
			let isSelected = element.classList.contains('sortable-selected');
			if (inSelection && !isSelected) {
				Sortable.utils.select(element);
			} else if (!inSelection && isSelected) {
				Sortable.utils.deselect(element);
			}
		});
	});

	onDestroy(() => {
		unsubscribe();
	});
</script>

<div
	bind:this={container}
	class="sortable {orientation} flex {orientation === 'vertical' ? 'flex-col' : 'flex-row gap-1'}"
>
	{#if node instanceof Map}
		{#each node as [fileId, file]}
			<div bind:this={elements[fileId]} data-id={fileId}>
				<FileListNodeStore {file} />
			</div>
		{/each}
	{:else if node instanceof GPXFile}
		{#if waypointRoot}
			{#if node.wpt.length > 0}
				<div bind:this={elements['waypoints']}>
					<FileListNode node={node.wpt} item={item.extend('waypoints')} />
				</div>
			{/if}
		{:else}
			{#each node.children as child, i}
				<div bind:this={elements[i]}>
					<FileListNode node={child} item={item.extend(i)} />
				</div>
			{/each}
		{/if}
	{:else if node instanceof Track}
		{#each node.children as child, i}
			<div bind:this={elements[i]} class="ml-1">
				<FileListNodeLabel item={item.extend(i)} label={`Segment ${i + 1}`} />
			</div>
		{/each}
	{:else if Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint}
		{#each node as wpt, i}
			<div bind:this={elements[i]} class="ml-1">
				<FileListNodeLabel item={item.extend(i)} label={wpt.name ?? `Waypoint ${i + 1}`} />
			</div>
		{/each}
	{/if}
</div>

{#if node instanceof GPXFile}
	{#if !waypointRoot}
		<svelte:self {node} {item} waypointRoot={true} />
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
