<script lang="ts">
	import { fileOrder, files, getFileIndex, selectedFiles, selectFiles } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import Sortable from 'sortablejs/Sortable';

	import type { GPXFile } from 'gpx';

	import { afterUpdate, onMount } from 'svelte';
	import { get } from 'svelte/store';

	let tabs: HTMLDivElement;
	let buttons: HTMLButtonElement[] = [];
	let sortable: Sortable;

	function selectFile(file: GPXFile) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.clear();
			selectedFiles.add(file);
			return selectedFiles;
		});
	}

	function addSelectFile(file: GPXFile) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.add(file);
			return selectedFiles;
		});
	}

	function selectAllFiles() {
		selectedFiles.update((selectedFiles) => {
			get(files).forEach((file) => {
				selectedFiles.add(get(file));
			});
			return selectedFiles;
		});
	}

	function deselectFile(file: GPXFile) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.delete(file);
			return selectedFiles;
		});
	}

	function updateFileOrder() {
		let newFileOrder = sortable.toArray().map((index: string) => get(get(files)[parseInt(index)]));
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
		sortable = Sortable.create(tabs, {
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'shift',
			selectedClass: 'sortable-selected',
			avoidImplicitDeselect: true,
			onSelect: (e) => {
				const index = parseInt(e.item.getAttribute('data-id'));
				addSelectFile(get($files[index]));
				if (!e.originalEvent.shiftKey && $selectedFiles.size > 1) {
					$selectedFiles.forEach((file) => {
						if (file !== get($files[index])) {
							deselectFile(file);
							const index = getFileIndex(file);
							Sortable.utils.deselect(buttons[index]);
						}
					});
				}
			},
			onDeselect: (e) => {
				const index = parseInt(e.item.getAttribute('data-id'));
				deselectFile(get($files[index]));
			},
			onSort: () => {
				updateFileOrder();
			}
		});
	});

	selectFiles.update(() => {
		return {
			select: (file: GPXFile) => {
				buttons.forEach((button) => {
					if (button) {
						Sortable.utils.deselect(button);
					}
				});
				const index = getFileIndex(file);
				Sortable.utils.select(buttons[index]);
				selectFile(file);
			},
			addSelect: (file: GPXFile) => {
				const index = getFileIndex(file);
				Sortable.utils.select(buttons[index]);
				addSelectFile(file);
			},
			selectAllFiles: () => {
				$files.forEach((file, index) => {
					Sortable.utils.select(buttons[index]);
				});
				selectAllFiles();
			},
			removeSelect: (file: GPXFile) => {
				const index = getFileIndex(file);
				Sortable.utils.deselect(buttons[index]);
				deselectFile(file);
			}
		};
	});

	afterUpdate(updateFileOrder);
</script>

<div class="h-10 -translate-y-10 w-full pointer-events-none">
	<ScrollArea orientation="horizontal" class="w-full h-full" scrollbarXClasses="h-2">
		<div bind:this={tabs} class="flex flex-row gap-1">
			{#each $files as file, index}
				<button
					bind:this={buttons[index]}
					data-id={index}
					class="my-1 px-1.5 py-1 rounded bg-secondary hover:bg-gray-200 shadow-none first:ml-1 last:mr-1 pointer-events-auto"
				>
					{get(file).metadata.name}
				</button>
			{/each}
		</div>
	</ScrollArea>
</div>

<style lang="postcss">
	div :global(.sortable-selected) {
		@apply bg-background shadow;
	}
</style>
