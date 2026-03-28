<script lang="ts">
    import Logo from '$lib/components/Logo.svelte';
    import { Button } from '$lib/components/ui/button';
    import { BookOpenText, House, Map } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
</script>

<nav class="sticky top-0 w-full px-12 py-2 bg-background z-50 flex flex-col items-center border-b">
    <div class="w-full max-w-5xl flex flex-row items-center gap-4 sm:gap-8">
        <a
            href={getURLForLanguage(i18n.lang, '/')}
            class="shrink-0 translate-y-0.25 justify-self-start"
        >
            <Logo class="h-8 xs:hidden" iconOnly={true} width="26" />
            <Logo class="h-8 hidden xs:block" width="153" />
        </a>
        <Button
            variant="link"
            class="text-base px-0 has-[>svg]:px-0 ml-auto"
            href={getURLForLanguage(i18n.lang, '/')}
        >
            <House size="18" />
            {i18n._('homepage.home')}
        </Button>
        <Button
            data-sveltekit-reload
            variant="link"
            class="text-base px-0 has-[>svg]:px-0"
            href={getURLForLanguage(i18n.lang, '/app')}
        >
            <Map size="18" />
            {i18n._('homepage.app')}
        </Button>
        <Button
            variant="link"
            class="text-base px-0 has-[>svg]:px-0"
            href={getURLForLanguage(i18n.lang, '/help')}
        >
            <BookOpenText size="18" />
            {i18n._('menu.help')}
        </Button>
    </div>
</nav>
