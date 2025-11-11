<script lang="ts">
    import { CircleQuestionMark } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import type { Snippet } from 'svelte';

    let {
        link,
        class: className = '',
        children,
    }: {
        link: string;
        class?: string;
        children: Snippet;
    } = $props();
</script>

<div class="text-sm bg-secondary rounded border flex flex-row items-center p-2 {className}">
    <CircleQuestionMark size="16" class="w-4 mr-2 shrink-0 grow-0" />
    <div>
        {@render children()}
        {#if link}
            <a href={link} target="_blank" class="text-sm text-link hover:underline">
                {i18n._('menu.more')}
            </a>
        {/if}
    </div>
</div>
