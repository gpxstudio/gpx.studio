<script lang="ts">
	import { files, selectedFiles, addSelectFile, selectFile } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
</script>

<div class="flex flex-col h-full w-full">
	<Label class="w-full">Files</Label>
	<ScrollArea class="w-full h-full">
		<div class="flex flex-col">
			{#each $files as file}
				<Button
					variant={$selectedFiles.has(file) ? 'outline' : 'secondary'}
					class="w-full {$selectedFiles.has(file) ? 'hover:bg-background' : 'hover:bg-secondary'}"
					on:click={(e) => {
						if (e.shiftKey) {
							addSelectFile(file);
						} else {
							selectFile(file);
						}
					}}
				>
					{file.metadata.name}
				</Button>
			{/each}
		</div>
	</ScrollArea>
</div>
