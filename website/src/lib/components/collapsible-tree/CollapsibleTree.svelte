<script lang="ts">
    import { setContext, type Snippet } from 'svelte';
    import { CollapsibleTreeState } from './utils.svelte';

    const {
        defaultState = 'open',
        side = 'right',
        nohover = false,
        slotInsideTrigger = true,
        children,
    }: {
        defaultState?: 'open' | 'closed';
        side?: 'left' | 'right';
        nohover?: boolean;
        slotInsideTrigger?: boolean;
        children: Snippet;
    } = $props();

    let open = $state(new CollapsibleTreeState(defaultState));

    setContext('collapsible-tree-state', open);
    setContext('collapsible-tree-side', side);
    setContext('collapsible-tree-nohover', nohover);
    setContext('collapsible-tree-parent-id', 'root');
    setContext('collapsible-tree-slot-inside-trigger', slotInsideTrigger);
</script>

{@render children()}
