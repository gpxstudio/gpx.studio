<script lang="ts">
	import { type Tool, currentTool } from '$lib/stores';
	import { flyAndScale } from '$lib/utils';
	import * as Card from '$lib/components/ui/card';

	export let tool: Tool;
	export let active = false;

	$: active = $currentTool === tool;
</script>

{#if active}
	<div in:flyAndScale={{ x: -2, y: 0, duration: 100 }} class="translate-x-1 h-full">
		<div class="rounded-md shadow-md pointer-events-auto">
			<Card.Root class="border-none">
				<Card.Content class="p-3 flex flex-col gap-3">
					<slot />
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{/if}

<svelte:window
	on:keydown={(e) => {
		if (active && e.key === 'Escape') {
			currentTool.set(null);
		}
	}}
/>
