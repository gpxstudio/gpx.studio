<script lang="ts">
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import type { Snippet } from 'svelte';

    let {
        label,
        side = 'top',
        children,
        extra,
        class: className = '',
    }: {
        label: string;
        side?: 'top' | 'right' | 'bottom' | 'left';
        children: Snippet;
        extra?: Snippet;
        class?: string;
    } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger class={className} aria-label={label}>
            {@render children()}
        </Tooltip.Trigger>
        <Tooltip.Content {side}>
            <div class="flex flex-row items-center gap-2">
                <span>{label}</span>
                {@render extra?.()}
            </div>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
