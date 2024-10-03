<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { Builder } from 'bits-ui';

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
	export let builders: Builder[] = [];
</script>

<Tooltip.Root>
	<Tooltip.Trigger asChild let:builder>
		<Button builders={[...builders, builder]} {variant} {...$$restProps} on:click>
			<slot />
		</Button>
	</Tooltip.Trigger>
	<Tooltip.Content {side}>
		<span>{label}</span>
	</Tooltip.Content>
</Tooltip.Root>
