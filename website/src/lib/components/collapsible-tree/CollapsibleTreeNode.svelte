<script lang="ts">
    import * as Collapsible from '$lib/components/ui/collapsible';
    import { Button } from '$lib/components/ui/button';
    import { ChevronDown, ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { getContext, setContext, type Snippet } from 'svelte';
    import type { ClassValue } from 'svelte/elements';
    import type { CollapsibleTreeState } from './utils.svelte';
    import { stickyKey, stickyZIndex, trackStuck, type StickyLevel } from './sticky';

    const props: {
        id: string | number;
        class?: ClassValue;
        trigger: Snippet;
        /** Gets whether the node is open, for contents that are only worth building then. */
        content: Snippet<[boolean]>;
    } = $props();

    let treeState = getContext<CollapsibleTreeState>('collapsible-tree-state');
    let side = getContext<'left' | 'right'>('collapsible-tree-side');
    let nohover = getContext<boolean>('collapsible-tree-nohover');
    let slotInsideTrigger = getContext<boolean>('collapsible-tree-slot-inside-trigger');
    let parentId = getContext<string>('collapsible-tree-parent-id');
    // where the row sticks, under the rows of the nodes this one is in
    let level = getContext<StickyLevel>(stickyKey);

    let fullId = `${parentId}.${props.id}`;
    setContext('collapsible-tree-parent-id', fullId);

    let open = treeState.get(fullId);

    // the rows of the nodes in this one stick under this row, whatever its height
    let rowHeight = $state(0);
    setContext<StickyLevel>(stickyKey, {
        get enabled() {
            return level.enabled;
        },
        get top() {
            return level.top + rowHeight;
        },
        get depth() {
            return level.depth + 1;
        },
        get stuckRows() {
            return level.stuckRows;
        },
    });
    // the row is on top of the content that goes under it
    let stuck = $state(false);
    // only the deepest row that is stuck has a border: the rows above it run into it
    let bordered = $derived(stuck && level.stuckRows.deepest === level.depth);

    export function openNode() {
        open.current = true;
    }
</script>

{#snippet row()}
    {#if slotInsideTrigger}
        <Collapsible.Trigger class="w-full">
            <Button
                variant="ghost"
                size="icon"
                class="w-full flex flex-row gap-1 border-none {side === 'right'
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
            class="w-full flex flex-row gap-1 border-none {side === 'right'
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
{/snippet}

<Collapsible.Root bind:open={open.current} class={props.class}>
    {#if level.enabled}
        <!-- sticks while some of the content of the node is in view, with a border when it does -->
        <div
            class={['sticky bg-background', bordered && 'border-b']}
            style="top: {level.top}px; z-index: {stickyZIndex(level.depth)}"
            bind:clientHeight={rowHeight}
            {@attach (row) => {
                const stop = trackStuck(
                    row,
                    () => level.top,
                    (value) => {
                        stuck = value;
                        level.stuckRows.set(fullId, level.depth, value);
                    }
                );
                return () => {
                    stop?.();
                    level.stuckRows.set(fullId, level.depth, false);
                };
            }}
        >
            {@render row()}
        </div>
    {:else}
        {@render row()}
    {/if}
    <Collapsible.Content>
        {@render props.content(open.current)}
    </Collapsible.Content>
</Collapsible.Root>
