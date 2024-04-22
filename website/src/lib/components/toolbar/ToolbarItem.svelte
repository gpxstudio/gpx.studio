<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
</script>

<Tooltip.Root openDelay={300}>
	<Tooltip.Trigger asChild let:builder>
		<Button builders={[builder]} variant="ghost" class="h-fit px-1 py-1.5" on:click>
			<slot name="icon" />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content side="right">
		<slot name="tooltip" />
	</Tooltip.Content>
</Tooltip.Root>
