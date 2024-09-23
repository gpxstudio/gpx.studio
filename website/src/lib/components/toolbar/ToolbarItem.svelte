<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { currentTool, type Tool } from '$lib/stores';

	export let tool: Tool;
	export let label: string;

	function toggleTool() {
		currentTool.update((current) => (current === tool ? null : tool));
	}
</script>

<Tooltip.Root openDelay={300}>
	<Tooltip.Trigger asChild let:builder>
		<Button
			builders={[builder]}
			variant="ghost"
			class="h-[26px] px-1 py-1.5 {$currentTool === tool ? 'bg-accent' : ''}"
			on:click={toggleTool}
			aria-label={label}
		>
			<slot name="icon" />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content side="right">
		<span>{label}</span>
	</Tooltip.Content>
</Tooltip.Root>
