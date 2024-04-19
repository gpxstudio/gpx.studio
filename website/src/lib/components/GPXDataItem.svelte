<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		<slot name="data" />
	</Tooltip.Trigger>
	<Tooltip.Content side="top">
		<slot name="tooltip" />
	</Tooltip.Content>
</Tooltip.Root>
