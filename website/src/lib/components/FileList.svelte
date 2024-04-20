<script lang="ts">
	import { files, selectedFiles, selectFiles } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index';

	import Sortable from 'sortablejs/Sortable';

	import { onMount, tick } from 'svelte';
	import type { GPXFile } from 'gpx';

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

	function deselectFile(file: GPXFile) {
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
				console.log('onSelect', e);
				const index = parseInt(e.item.getAttribute('data-id'));
				addSelectFile($files[index]);
			},
			onDeselect: (e) => {
				console.log('onDeselect');
				const index = parseInt(e.item.getAttribute('data-id'));
				deselectFile($files[index]);
			}
		});
	});

	selectFiles.update(() => {
		return {
			select: (file: GPXFile) => {
				console.log('select');
				buttons.forEach((button) => {
					if (button) {
						Sortable.utils.deselect(button);
					}
				});
				const index = $files.indexOf(file);
				Sortable.utils.select(buttons[index]);
				selectFile(file);
			},
			addSelect: (file: GPXFile) => {
				console.log('addSelect');
				const index = $files.indexOf(file);
				Sortable.utils.select(buttons[index]);
				addSelectFile(file);
			},
			removeSelect: (file: GPXFile) => {
				console.log('removeSelect');
				const index = $files.indexOf(file);
				Sortable.utils.deselect(buttons[index]);
				deselectFile(file);
			}
		};
	});
</script>

<div class="absolute h-10 -translate-y-10 w-fit max-w-full bg-secondary rounded-t">
	<ScrollArea orientation="horizontal" class="w-full h-full" scrollbarXClasses="h-2">
		<div bind:this={tabs} class="flex flex-row gap-1">
			{#each $files as file, index}
				<button
					bind:this={buttons[index]}
					data-id={index}
					class="my-1 px-1.5 py-1 rounded bg-secondary hover:bg-gray-200 shadow-none first:ml-1 last:mr-1"
				>
					{file.metadata.name}
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
