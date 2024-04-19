<script lang="ts">
	import { files, selectedFiles, addSelectFile, selectFile } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import Sortable from 'sortablejs';

	import { onMount } from 'svelte';

	let tabs: HTMLDivElement;

	onMount(() => {
		Sortable.create(tabs, {
			forceAutoScrollFallback: true
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
						: 'bg-secondary'} first:ml-1 last:mr-1"
					on:click={(e) => {
						if (e.shiftKey) {
							addSelectFile(file);
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
