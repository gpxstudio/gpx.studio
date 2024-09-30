<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	export let variant:
		| 'default'
		| 'secondary'
		| 'link'
		| 'destructive'
		| 'outline'
		| 'ghost'
		| undefined = 'default';
	export let label: string;
	export let side: 'top' | 'right' | 'bottom' | 'left' = 'top';
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<Button builders={[builder]} {variant} {...$$restProps} on:click>
			<slot />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content {side}>
		<span>{label}</span>
	</Tooltip.Content>
</Tooltip.Root>
