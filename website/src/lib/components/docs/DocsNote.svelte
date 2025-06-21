<script lang="ts">
    import type { Snippet } from 'svelte';

    let { type = 'note', children }: { type?: 'note' | 'warning'; children: Snippet } = $props();
</script>

<div
    class="bg-secondary border-l-8 {type === 'note'
        ? 'border-link'
        : 'border-destructive'} p-2 text-sm rounded-md"
>
    {@render children()}
</div>

<style lang="postcss">
    @reference "../../../app.css";

    div :global(a) {
        @apply text-link;
        @apply hover:underline;
    }
</style>
