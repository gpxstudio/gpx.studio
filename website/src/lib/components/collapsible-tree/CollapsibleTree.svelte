<script lang="ts">
    import { getContext, setContext, type Snippet } from 'svelte';
    import { CollapsibleTreeState, StuckRows } from './utils.svelte';
    import { stickyKey, type StickyLevel } from './sticky';

    const {
        defaultState = 'open',
        side = 'right',
        nohover = false,
        slotInsideTrigger = true,
        sticky = false,
        children,
    }: {
        defaultState?: 'open' | 'closed';
        side?: 'left' | 'right';
        nohover?: boolean;
        slotInsideTrigger?: boolean;
        /**
         * The rows of the nodes stick to the top of the scrolled area while some of the content of
         * their node is in view, each under the rows of the nodes it is in. A tree in a tree is
         * like its node.
         */
        sticky?: boolean;
        children: Snippet;
    } = $props();

    let open = $state(new CollapsibleTreeState(defaultState));

    setContext('collapsible-tree-state', open);
    setContext('collapsible-tree-side', side);
    setContext('collapsible-tree-nohover', nohover);
    setContext('collapsible-tree-parent-id', 'root');
    setContext('collapsible-tree-slot-inside-trigger', slotInsideTrigger);
    setContext<StickyLevel>(
        stickyKey,
        getContext<StickyLevel | undefined>(stickyKey) ?? {
            enabled: sticky,
            top: 0,
            depth: 0,
            stuckRows: new StuckRows(),
        }
    );
</script>

{@render children()}
