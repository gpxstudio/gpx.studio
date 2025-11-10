<script lang="ts">
    import { page } from '$app/state';
    import * as Select from '$lib/components/ui/select';
    import { languages } from '$lib/languages';
    import { getURLForLanguage } from '$lib/utils';
    import { Languages } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';

    let {
        class: className = '',
    }: {
        class?: string;
    } = $props();
</script>

<Select.Root type="single" value={i18n.lang}>
    <Select.Trigger class="min-w-[180px] {className}" aria-label={i18n._('menu.language')}>
        <Languages size="16" />
        <span class="mr-auto">
            {languages[i18n.lang]}
        </span>
    </Select.Trigger>
    <Select.Content>
        {#each Object.entries(languages) as [lang, label]}
            {#if page.url.pathname.includes('404')}
                <a href={getURLForLanguage(lang, '/')}>
                    <Select.Item value={lang}>{label}</Select.Item>
                </a>
            {:else}
                <a href={getURLForLanguage(lang, page.url.pathname)}>
                    <Select.Item value={lang}>{label}</Select.Item>
                </a>
            {/if}
        {/each}
    </Select.Content>
</Select.Root>
