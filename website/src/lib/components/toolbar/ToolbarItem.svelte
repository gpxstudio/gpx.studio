<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import { currentTool, Tool } from '$lib/components/toolbar/tools';
    import type { Snippet } from 'svelte';

    let {
        itemTool,
        label,
        children,
    }: {
        itemTool: Tool;
        label: string;
        children: Snippet;
    } = $props();

    function toggleTool() {
        if ($currentTool === itemTool) {
            $currentTool = null;
        } else {
            $currentTool = itemTool;
        }
    }
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    variant="ghost"
                    class="size-[24px] {$currentTool === itemTool ? 'bg-accent' : ''}"
                    onclick={toggleTool}
                    aria-label={label}
                >
                    {@render children()}
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="right">
            <span>{label}</span>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
