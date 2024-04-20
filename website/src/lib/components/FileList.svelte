<script lang="ts">
	import { files, selectedFiles, addSelectFile, selectFile, removeSelectFile } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import { onMount } from 'svelte';

	let tabs: HTMLDivElement;

	onMount(async () => {
		const sortablejs = await import('sortablejs');
		const Sortable = sortablejs.default;
		const MultiDrag = sortablejs.MultiDrag;

		Sortable.mount(new MultiDrag());

		Sortable.create(tabs, {
			forceAutoScrollFallback: true,
			multiDrag: true,
			multiDragKey: 'shift'
		});
	});
</script>

<div class="absolute h-10 -translate-y-10 w-fit max-w-full bg-secondary rounded-t">
	<ScrollArea orientation="horizontal" class="w-full h-full" scrollbarXClasses="h-2">
		<div bind:this={tabs} class="flex flex-row gap-1">
			{#each $files as file}
				<button
					class="my-1 px-1.5 py-1 rounded {$selectedFiles.has(file)
						? 'bg-background shadow'
						: 'bg-secondary hover:bg-gray-200'} first:ml-1 last:mr-1"
					on:click={(e) => {
						if (e.shiftKey) {
							if ($selectedFiles.has(file)) {
								removeSelectFile(file);
							} else {
								addSelectFile(file);
							}
						} else {
							selectFile(file);
						}
					}}
				>
					{file.metadata.name}
				</button>
			{/each}
		</div>
	</ScrollArea>
</div>
