<script lang="ts">
	import { files } from '$lib/stores';

	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button';
</script>

<ScrollArea class="w-full h-full">
	<div class="flex flex-col">
		{#each $files as file}
			<Button variant="outline" class="w-full">
				{file.metadata.name}
			</Button>
		{/each}
	</div>
</ScrollArea>
