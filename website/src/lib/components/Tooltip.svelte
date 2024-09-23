<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	export let label: string;
	export let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
</script>

<Tooltip.Root>
	<Tooltip.Trigger {...$$restProps} aria-label={label}>
		<slot />
	</Tooltip.Trigger>
	<Tooltip.Content {side}>
		<div class="flex flex-row items-center">
			<span>{label}</span>
			<slot name="extra" />
		</div>
	</Tooltip.Content>
</Tooltip.Root>
