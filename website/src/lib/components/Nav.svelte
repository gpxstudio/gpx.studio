<script lang="ts">
    import Logo from '$lib/components/Logo.svelte';
    import { Button } from '$lib/components/ui/button';
    import AlgoliaDocSearch from '$lib/components/AlgoliaDocSearch.svelte';
    import ModeSwitch from '$lib/components/ModeSwitch.svelte';
    import { BookOpenText, House, Map } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
</script>

<nav class="w-full sticky top-0 bg-background z-50">
    <div class="mx-6 py-2 flex flex-row items-center border-b gap-4 sm:gap-8">
        <a href={getURLForLanguage(i18n.lang, '/')} class="shrink-0 translate-y-0.5">
            <Logo class="h-8 sm:hidden" iconOnly={true} width="26" />
            <Logo class="h-8 hidden sm:block" width="153" />
        </a>
        <Button variant="link" class="text-base px-0" href={getURLForLanguage(i18n.lang, '/')}>
            <House size="18" />
            {i18n._('homepage.home')}
        </Button>
        <Button variant="link" class="text-base px-0" href={getURLForLanguage(i18n.lang, '/app')}>
            <Map size="18" />
            {i18n._('homepage.app')}
        </Button>
        <Button variant="link" class="text-base px-0" href={getURLForLanguage(i18n.lang, '/help')}>
            <BookOpenText size="18" />
            {i18n._('menu.help')}
        </Button>
        <AlgoliaDocSearch class="ml-auto" />
        <ModeSwitch class="hidden xs:inline-flex" />
    </div>
</nav>
