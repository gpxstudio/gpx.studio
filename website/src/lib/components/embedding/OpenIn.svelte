<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import Logo from '$lib/components/Logo.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { i18n } from '$lib/i18n.svelte';

    let {
        files,
        ids,
    }: {
        files: string[];
        ids: string[];
    } = $props();
</script>

<Button
    variant="ghost"
    class="absolute top-0 flex-wrap h-fit bg-background font-semibold rounded-md py-1 px-2 gap-1.5 xs:text-base mt-2.5 ml-2.5 mr-12"
    href="{getURLForLanguage(i18n.lang, '/app')}?{files.length > 0
        ? `files=${encodeURIComponent(JSON.stringify(files))}`
        : ''}{files.length > 0 && ids.length > 0 ? '&' : ''}{ids.length > 0
        ? `ids=${encodeURIComponent(JSON.stringify(ids))}`
        : ''}"
    target="_blank"
>
    {i18n._('menu.open_in')}
    <Logo class="h-[18px] xs:h-5 translate-y-[1px]" />
</Button>
