<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { currentTool, type Tool } from '$lib/stores';

	export let tool: Tool;

	function toggleTool() {
		currentTool.update((current) => (current === tool ? null : tool));
	}
</script>

<Tooltip.Root openDelay={300}>
	<Tooltip.Trigger asChild let:builder>
		<Button
			builders={[builder]}
			variant="ghost"
			class="h-fit px-1 py-1.5 {$currentTool === tool ? 'bg-accent' : ''}"
			on:click={toggleTool}
		>
			<slot name="icon" />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content side="right">
		<slot name="tooltip" />
	</Tooltip.Content>
</Tooltip.Root>
