<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	export let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
</script>

<Tooltip.Root>
	<Tooltip.Trigger {...$$restProps}>
		<slot name="data" />
	</Tooltip.Trigger>
	<Tooltip.Content {side}>
		<slot name="tooltip" />
	</Tooltip.Content>
</Tooltip.Root>
