<script lang="ts">
	import { fileOrder, selectedFiles, selectFiles } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import Sortable from 'sortablejs/Sortable';

	import { afterUpdate, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import FileListItem from './FileListItem.svelte';
	import { fileObservers } from '$lib/db';

	let container: HTMLDivElement;
	let buttons: { [id: string]: HTMLElement } = {};
	let sortable: Sortable;

	function selectFile(fileId: string) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.clear();
			selectedFiles.add(fileId);
			return selectedFiles;
		});
	}

	function addSelectFile(fileId: string) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.add(fileId);
			return selectedFiles;
		});
	}

	function selectAllFiles() {
		selectedFiles.update((selectedFiles) => {
			get(fileObservers).forEach((_, id) => {
				selectedFiles.add(id);
			});
			return selectedFiles;
		});
	}

	function deselectFile(fileId: string) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.delete(fileId);
			return selectedFiles;
		});
	}

	function updateFileOrder() {
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

	onMount(() => {
		sortable = Sortable.create(container, {
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'shift',
			selectedClass: 'sortable-selected',
			avoidImplicitDeselect: true,
			onSelect: (e) => {
				let selectedId = e.item.getAttribute('data-id');
				addSelectFile(selectedId);
				if (!e.originalEvent.shiftKey && $selectedFiles.size > 1) {
					$selectedFiles.forEach((fileId) => {
						if (fileId !== selectedId) {
							deselectFile(fileId);
							Sortable.utils.deselect(buttons[fileId]);
						}
					});
				}
			},
			onDeselect: (e) => {
				deselectFile(e.item.getAttribute('data-id'));
			},
			onSort: () => {
				updateFileOrder();
			}
		});
	});

	selectFiles.update(() => {
		return {
			select: (fileId: string) => {
				Object.values(buttons).forEach((button) => {
					Sortable.utils.deselect(button);
				});
				Sortable.utils.select(buttons[fileId]);
				selectFile(fileId);
			},
			addSelect: (fileId: string) => {
				Sortable.utils.select(buttons[fileId]);
				addSelectFile(fileId);
			},
			selectAllFiles: () => {
				Object.values(buttons).forEach((button) => {
					Sortable.utils.select(button);
				});
				selectAllFiles();
			},
			removeSelect: (fileId: string) => {
				Sortable.utils.deselect(buttons[fileId]);
				deselectFile(fileId);
			}
		};
	});

	afterUpdate(() => {
		updateFileOrder();
		Object.keys(buttons).forEach((fileId) => {
			if (!get(fileObservers).has(fileId)) {
				delete buttons[fileId];
			}
		});
	});
</script>

<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
	<ScrollArea orientation="horizontal" class="w-full h-full" scrollbarXClasses="h-2">
		<div bind:this={container} class="flex flex-row gap-1">
			{#if $fileObservers}
				{#each $fileObservers.entries() as [fileId, file]}
					<div
						bind:this={buttons[fileId]}
						data-id={fileId}
						class="pointer-events-auto first:ml-1 last:mr-1 mb-1 bg-transparent"
					>
						<FileListItem {file} />
					</div>
				{/each}
			{/if}
		</div>
	</ScrollArea>
</div>

<style lang="postcss">
	div :global(button) {
		@apply bg-accent;
		@apply hover:bg-background;
	}

	div :global(.sortable-selected button) {
		@apply bg-background;
	}
</style>
