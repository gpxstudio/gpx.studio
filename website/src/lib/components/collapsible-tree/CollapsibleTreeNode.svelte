<script lang="ts">
    import * as Collapsible from '$lib/components/ui/collapsible';
    import { Button } from '$lib/components/ui/button';
    import { ChevronDown, ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { getContext, setContext, type Snippet } from 'svelte';
    import type { ClassValue } from 'svelte/elements';
    import type { CollapsibleTreeState } from './utils.svelte';

    const props: {
        id: string | number;
        class?: ClassValue;
        trigger: Snippet;
        content: Snippet;
    } = $props();

    let state = getContext<CollapsibleTreeState>('collapsible-tree-state');
    let side = getContext<'left' | 'right'>('collapsible-tree-side');
    let nohover = getContext<boolean>('collapsible-tree-nohover');
    let slotInsideTrigger = getContext<boolean>('collapsible-tree-slot-inside-trigger');
    let parentId = getContext<string>('collapsible-tree-parent-id');

    let fullId = `${parentId}.${props.id}`;
    setContext('collapsible-tree-parent-id', fullId);

    let open = state.get(fullId);

    export function openNode() {
        open.current = true;
    }
</script>

<Collapsible.Root bind:open={open.current} class={props.class}>
    {#if slotInsideTrigger}
        <Collapsible.Trigger class="w-full">
            <Button
                variant="ghost"
                size="icon"
                class="w-full flex flex-row gap-1 {side === 'right'
                    ? 'justify-between'
                    : 'justify-start pl-1'} h-fit {nohover
                    ? 'hover:bg-background'
                    : ''} pointer-events-none"
            >
                {#if side === 'left'}
                    {#if open.current}
                        <ChevronDown size="16" class="shrink-0" />
                    {:else}
                        <ChevronRight size="16" class="shrink-0" />
                    {/if}
                {/if}
                {@render props.trigger()}
                {#if side === 'right'}
                    {#if open.current}
                        <ChevronDown size="16" class="shrink-0" />
                    {:else}
                        <ChevronLeft size="16" class="shrink-0" />
                    {/if}
                {/if}
            </Button>
        </Collapsible.Trigger>
    {:else}
        <Button
            variant="ghost"
            size="icon"
            class="w-full flex flex-row gap-1 {side === 'right'
                ? 'justify-between'
                : 'justify-start pl-1'} h-fit {nohover ? 'hover:bg-background' : ''}"
        >
            {#if side === 'left'}
                <Collapsible.Trigger>
                    {#if open.current}
                        <ChevronDown size="16" class="shrink-0" />
                    {:else}
                        <ChevronRight size="16" class="shrink-0" />
                    {/if}
                </Collapsible.Trigger>
            {/if}
            {@render props.trigger()}
            {#if side === 'right'}
                <Collapsible.Trigger>
                    {#if open.current}
                        <ChevronDown size="16" class="shrink-0" />
                    {:else}
                        <ChevronLeft size="16" class="shrink-0" />
                    {/if}
                </Collapsible.Trigger>
            {/if}
        </Button>
    {/if}
    <Collapsible.Content>
        {@render props.content()}
    </Collapsible.Content>
</Collapsible.Root>
