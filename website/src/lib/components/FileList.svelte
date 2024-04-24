<script lang="ts">
	import { fileOrder, files, selectedFiles, selectFiles } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index';
	import Sortable from 'sortablejs/Sortable';

	import type { GPXFile } from 'gpx';

	import { onMount } from 'svelte';
	import { get, type Writable } from 'svelte/store';

	let tabs: HTMLDivElement;
	let buttons: HTMLButtonElement[] = [];
	let sortable: Sortable;

	function selectFile(file: Writable<GPXFile>) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.clear();
			selectedFiles.add(file);
			return selectedFiles;
		});
	}

	function addSelectFile(file: Writable<GPXFile>) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.add(file);
			return selectedFiles;
		});
	}

	function selectAllFiles() {
		selectedFiles.update((selectedFiles) => {
			get(files).forEach((file) => {
				selectedFiles.add(file);
			});
			return selectedFiles;
		});
	}

	function deselectFile(file: Writable<GPXFile>) {
		selectedFiles.update((selectedFiles) => {
			selectedFiles.delete(file);
			return selectedFiles;
		});
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
				addSelectFile($files[index]);
				if (!e.originalEvent.shiftKey && $selectedFiles.size > 1) {
					$selectedFiles.forEach((file) => {
						if (file !== $files[index]) {
							deselectFile(file);
							const index = $files.indexOf(file);
							Sortable.utils.deselect(buttons[index]);
						}
					});
				}
			},
			onDeselect: (e) => {
				const index = parseInt(e.item.getAttribute('data-id'));
				deselectFile($files[index]);
			},
			onSort: () => {
				$fileOrder = sortable.toArray().map((index: string) => $files[parseInt(index)]);
			}
		});
	});

	selectFiles.update(() => {
		return {
			select: (file: Writable<GPXFile>) => {
				buttons.forEach((button) => {
					if (button) {
						Sortable.utils.deselect(button);
					}
				});
				const index = $files.indexOf(file);
				Sortable.utils.select(buttons[index]);
				selectFile(file);
			},
			addSelect: (file: Writable<GPXFile>) => {
				const index = $files.indexOf(file);
				Sortable.utils.select(buttons[index]);
				addSelectFile(file);
			},
			selectAllFiles: () => {
				$files.forEach((file, index) => {
					Sortable.utils.select(buttons[index]);
				});
				selectAllFiles();
			},
			removeSelect: (file: Writable<GPXFile>) => {
				const index = $files.indexOf(file);
				Sortable.utils.deselect(buttons[index]);
				deselectFile(file);
			}
		};
	});
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
