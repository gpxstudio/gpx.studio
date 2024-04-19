<script lang="ts">
	import { files, selectedFiles, addSelectFile, selectFile } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
</script>

<div class="absolute h-10 -translate-y-10 w-fit max-w-full bg-secondary rounded-t px-1">
	<ScrollArea orientation="horizontal" class="w-full h-full" scrollbarXClasses="h-2">
		<div class="flex flex-row gap-1">
			{#each $files as file}
				<button
					class="my-1 px-1.5 py-1 rounded {$selectedFiles.has(file)
						? 'bg-background shadow'
						: 'bg-secondary'}"
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
