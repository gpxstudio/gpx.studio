<script lang="ts">
	import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
	import { afterUpdate, getContext, onDestroy, onMount } from 'svelte';
	import Sortable from 'sortablejs/Sortable';
	import { fileObservers, settings, type GPXFileWithStatistics } from '$lib/db';
	import { get, type Readable } from 'svelte/store';
	import FileListNodeStore from './FileListNodeStore.svelte';
	import FileListNode from './FileListNode.svelte';
	import FileListNodeLabel from './FileListNodeLabel.svelte';
	import { ListLevel, moveItems, type ListItem } from './FileList';
	import { selection } from './Selection';
	import { _ } from 'svelte-i18n';

	export let node:
		| Map<string, Readable<GPXFileWithStatistics | undefined>>
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>;
	export let item: ListItem;
	export let waypointRoot: boolean = false;

	let container: HTMLElement;
	let elements: { [id: string | number]: HTMLElement } = {};
	let sortableLevel: ListLevel =
		node instanceof Map
			? ListLevel.FILE
			: node instanceof GPXFile
				? waypointRoot
					? ListLevel.WAYPOINTS
					: ListLevel.TRACK
				: node instanceof Track
					? ListLevel.SEGMENT
					: ListLevel.WAYPOINT;
	let pull: Record<string, string[]> = {
		file: ['file', 'track'],
		track: ['file', 'track'],
		segment: ['file', 'track', 'segment'],
		waypoint: ['waypoint']
	};
	let sortable: Sortable;
	let orientation = getContext<'vertical' | 'horizontal'>('orientation');

	function onSelectChange() {
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
				return $selection;
			});
		}
	}

	const { fileOrder } = settings;
	function syncFileOrder() {
		if (!sortable || sortableLevel !== ListLevel.FILE) {
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
			direction: orientation,
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'Meta',
			avoidImplicitDeselect: true,
			onSelect: onSelectChange,
			onDeselect: onSelectChange,
			onSort: (e) => {
				if (sortableLevel === ListLevel.FILE) {
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
				} else {
					let fromItem = Sortable.get(e.from)._item;
					let toItem = Sortable.get(e.to)._item;

					if (item === toItem) {
						// Event is triggered on source and destination list, only handle it once
						let fromItems = [];
						let toItems = [];

						if (waypointRoot) {
							fromItems = [fromItem.extend('waypoints')];
							toItems = [toItem.extend('waypoints')];
						} else {
							let oldIndices =
								e.oldIndicies.length > 0 ? e.oldIndicies.map((i) => i.index) : [e.oldIndex];
							let newIndices =
								e.newIndicies.length > 0 ? e.newIndicies.map((i) => i.index) : [e.newIndex];
							oldIndices.sort((a, b) => a - b);
							newIndices.sort((a, b) => a - b);

							fromItems = oldIndices.map((i) => fromItem.extend(i));
							toItems = newIndices.map((i) => toItem.extend(i));
						}

						moveItems(fromItem, toItem, fromItems, toItems);
					}
				}
			}
		});
		Object.defineProperty(sortable, '_item', {
			value: item,
			writable: true
		});
		selection.set(get(selection));
	});

	$: if ($fileOrder) {
		syncFileOrder();
	}

	afterUpdate(() => {
		syncFileOrder();
		if (sortableLevel === ListLevel.FILE) {
			Object.keys(elements).forEach((fileId) => {
				if (!get(fileObservers).has(fileId)) {
					delete elements[fileId];
				}
			});
		} else if (sortableLevel === ListLevel.WAYPOINTS) {
			if (node.wpt.length === 0) {
				delete elements['waypoints'];
			}
		} else {
			Object.keys(elements).forEach((index) => {
				if ((node instanceof GPXFile || node instanceof Track) && node.children.length <= index) {
					delete elements[index];
				} else if (Array.isArray(node) && node.length <= index) {
					delete elements[index];
				}
			});
		}
		if (sortableLevel !== ListLevel.FILE) {
			sortable.sort(Object.keys(elements));
		}
	});

	const unsubscribe = selection.subscribe(($selection) => {
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
	});

	function getChangedIds() {
		let changed: (string | number)[] = [];
		Object.entries(elements).forEach(([id, element]) => {
			if (element === null) {
				return;
			}
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
				<div bind:this={elements['waypoints']} data-id="waypoints">
					<FileListNode node={node.wpt} item={item.extend('waypoints')} />
				</div>
			{/if}
		{:else}
			{#each node.children as child, i}
				<div bind:this={elements[i]} data-id={i}>
					<FileListNode node={child} item={item.extend(i)} />
				</div>
			{/each}
		{/if}
	{:else if node instanceof Track}
		{#each node.children as child, i}
			<div bind:this={elements[i]} data-id={i} class="ml-1">
				<FileListNodeLabel item={item.extend(i)} label={`${$_('gpx.segment')} ${i + 1}`} />
			</div>
		{/each}
	{:else if Array.isArray(node) && node.length > 0 && node[0] instanceof Waypoint}
		{#each node as wpt, i}
			<div bind:this={elements[i]} data-id={i} class="ml-1">
				<FileListNodeLabel
					item={item.extend(i)}
					label={wpt.name ?? `${$_('gpx.waypoint')} ${i + 1}`}
				/>
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
