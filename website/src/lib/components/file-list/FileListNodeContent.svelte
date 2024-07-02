<script lang="ts" context="module">
	let dragging: Writable<ListLevel | null> = writable(null);

	let updating = false;
</script>

<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { afterUpdate, getContext, onMount } from 'svelte';
	import Sortable from 'sortablejs/Sortable';
	import { getFileIds, settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, writable, type Readable, type Writable } from 'svelte/store';
	import FileListNodeStore from './FileListNodeStore.svelte';
	import FileListNode from './FileListNode.svelte';
	import {
		ListFileItem,
		ListLevel,
		ListRootItem,
		ListWaypointsItem,
		allowedMoves,
		moveItems,
		type ListItem
	} from './FileList';
	import { selection } from './Selection';
	import { _ } from 'svelte-i18n';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| Readonly<Waypoint>;
	export let item: ListItem;
	export let waypointRoot: boolean = false;

	let container: HTMLElement;
	let elements: { [id: string]: HTMLElement } = {};
	let sortableLevel: ListLevel =
		node instanceof Map
			? ListLevel.FILE
			: node instanceof GPXFile
				? waypointRoot
					? ListLevel.WAYPOINTS
					: item instanceof ListWaypointsItem
						? ListLevel.WAYPOINT
						: ListLevel.TRACK
				: node instanceof Track
					? ListLevel.SEGMENT
					: ListLevel.WAYPOINT;
	let sortable: Sortable;
	let orientation = getContext<'vertical' | 'horizontal'>('orientation');

	function updateToSelection(e) {
		if (updating) return;
		updating = true;
		// Sortable updates selection
		let changed = getChangedIds();
		if (changed.length > 0) {
			selection.update(($selection) => {
				$selection.clear();
				Object.entries(elements).forEach(([id, element]) => {
					$selection.set(
						item.extend(getRealId(id)),
						element.classList.contains('sortable-selected')
					);
				});

				if (
					e.originalEvent &&
					$selection.size > 1 &&
					!(e.originalEvent.ctrlKey || e.originalEvent.metaKey || e.originalEvent.shiftKey)
				) {
					// Fix bug that sometimes causes a single select to be treated as a multi-select
					$selection.clear();
					$selection.set(item.extend(getRealId(changed[0])), true);
				}

				return $selection;
			});
		}
		updating = false;
	}

	function updateFromSelection() {
		if (updating) return;
		updating = true;
		// Selection updates sortable
		let changed = getChangedIds();
		for (let id of changed) {
			let element = elements[id];
			if (element) {
				if ($selection.has(item.extend(id))) {
					Sortable.utils.select(element);
					element.scrollIntoView({
						behavior: 'smooth',
						block: 'nearest'
					});
				} else {
					Sortable.utils.deselect(element);
				}
			}
		}
		updating = false;
	}

	$: if ($selection) {
		updateFromSelection();
	}

	const { fileOrder } = settings;
	function syncFileOrder() {
		if (!sortable || sortableLevel !== ListLevel.FILE) {
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

	$: if ($fileOrder) {
		syncFileOrder();
	}

	function createSortable() {
		sortable = Sortable.create(container, {
			group: {
				name: sortableLevel,
				pull: allowedMoves[sortableLevel],
				put: true
			},
			direction: orientation,
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'Meta',
			avoidImplicitDeselect: true,
			onSelect: updateToSelection,
			onDeselect: updateToSelection,
			onStart: () => {
				dragging.set(sortableLevel);
			},
			onEnd: () => {
				dragging.set(null);
			},
			onSort: (e) => {
				if (sortableLevel === ListLevel.FILE) {
					let newFileOrder = sortable.toArray();
					if (newFileOrder.length !== get(fileOrder).length) {
						fileOrder.set(newFileOrder);
					} else {
						for (let i = 0; i < newFileOrder.length; i++) {
							if (newFileOrder[i] !== get(fileOrder)[i]) {
								fileOrder.set(newFileOrder);
								break;
							}
						}
					}
				}

				let fromItem = Sortable.get(e.from)._item;
				let toItem = Sortable.get(e.to)._item;

				if (item === toItem && !(fromItem instanceof ListRootItem)) {
					// Event is triggered on source and destination list, only handle it once
					let fromItems = [];
					let toItems = [];

					if (Sortable.get(e.from)._waypointRoot) {
						fromItems = [fromItem.extend('waypoints')];
					} else {
						let oldIndices =
							e.oldIndicies.length > 0 ? e.oldIndicies.map((i) => i.index) : [e.oldIndex];
						oldIndices.sort((a, b) => a - b);

						fromItems = oldIndices.map((i) => fromItem.extend(i));
					}

					if (Sortable.get(e.from)._waypointRoot && Sortable.get(e.to)._waypointRoot) {
						toItems = [toItem.extend('waypoints')];
					} else {
						if (Sortable.get(e.to)._waypointRoot) {
							toItem = toItem.extend('waypoints');
						}

						let newIndices =
							e.newIndicies.length > 0 ? e.newIndicies.map((i) => i.index) : [e.newIndex];
						newIndices.sort((a, b) => a - b);

						if (toItem instanceof ListRootItem) {
							let newFileIds = getFileIds(newIndices.length);
							toItems = newIndices.map((i, index) => {
								$fileOrder.splice(i, 0, newFileIds[index]);
								return item.extend(newFileIds[index]);
							});
						} else {
							toItems = newIndices.map((i) => toItem.extend(i));
						}
					}

					moveItems(fromItem, toItem, fromItems, toItems);
				}
			}
		});
		Object.defineProperty(sortable, '_item', {
			value: item,
			writable: true
		});

		Object.defineProperty(sortable, '_waypointRoot', {
			value: waypointRoot,
			writable: true
		});
	}

	onMount(() => {
		createSortable();
	});

	afterUpdate(() => {
		elements = {};
		container.childNodes.forEach((element) => {
			if (element instanceof HTMLElement) {
				let attr = element.getAttribute('data-id');
				if (attr) {
					if (node instanceof Map && !node.has(attr)) {
						element.remove();
					} else {
						elements[attr] = element;
					}
				}
			}
		});

		syncFileOrder();
		updateFromSelection();
	});

	function getChangedIds() {
		let changed: (string | number)[] = [];
		Object.entries(elements).forEach(([id, element]) => {
			let realId = getRealId(id);
			let realItem = item.extend(realId);
			let inSelection = get(selection).has(realItem);
			let isSelected = element.classList.contains('sortable-selected');
			if (inSelection !== isSelected) {
				changed.push(realId);
			}
		});
		return changed;
	}

	function getRealId(id: string | number) {
		return sortableLevel === ListLevel.FILE || sortableLevel === ListLevel.WAYPOINTS
			? id
			: parseInt(id);
	}

	$: canDrop = $dragging !== null && allowedMoves[$dragging].includes(sortableLevel);
</script>

<div
	bind:this={container}
	class="sortable {orientation} flex {orientation === 'vertical'
		? 'flex-col'
		: 'flex-row gap-1'} {canDrop ? 'min-h-5' : ''}"
>
	{#if node instanceof Map}
		{#each node as [fileId, file] (fileId)}
			<div data-id={fileId}>
				<FileListNodeStore {file} />
			</div>
		{/each}
	{:else if node instanceof GPXFile}
		{#if item instanceof ListWaypointsItem}
			{#each node.wpt as wpt, i (wpt)}
				<div data-id={i} class="ml-1">
					<FileListNode node={wpt} item={item.extend(i)} />
				</div>
			{/each}
		{:else if waypointRoot}
			{#if node.wpt.length > 0}
				<div data-id="waypoints">
					<FileListNode {node} item={item.extend('waypoints')} />
				</div>
			{/if}
		{:else}
			{#each node.children as child, i (child)}
				<div data-id={i}>
					<FileListNode node={child} item={item.extend(i)} />
				</div>
			{/each}
		{/if}
	{:else if node instanceof Track}
		{#each node.children as child, i (child)}
			<div data-id={i} class="ml-1">
				<FileListNode node={child} item={item.extend(i)} />
			</div>
		{/each}
	{/if}
</div>

{#if node instanceof GPXFile && item instanceof ListFileItem}
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
