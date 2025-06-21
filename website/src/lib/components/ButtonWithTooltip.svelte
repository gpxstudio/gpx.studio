<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import type { Snippet } from 'svelte';

    const {
        variant = 'default',
        label,
        side = 'top',
        class: className = '',
        children,
        onclick,
    }: {
        variant?: 'default' | 'secondary' | 'link' | 'destructive' | 'outline' | 'ghost';
        label: string;
        side?: 'top' | 'right' | 'bottom' | 'left';
        class?: string;
        children: Snippet;
        onclick?: (event: MouseEvent) => void;
    } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button {...props} {variant} class={className} {onclick}>
                    {@render children()}
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content {side}>
            <span>{label}</span>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
