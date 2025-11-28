<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import Logo from '$lib/components/Logo.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { House, Map, BookOpenText } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
</script>

<div class="grow px-12 my-12 flex flex-col items-center justify-center gap-6">
    <p class="text-7xl font-black">404</p>
    <p class="text-xl -mt-6">{i18n._('page_not_found')}</p>
    <Logo class="h-40 my-3 animate-spin" style="animation-duration: 20000ms" iconOnly={true} />
    <div class="w-full flex flex-row flex-wrap gap-3 justify-center">
        <Button
            href={getURLForLanguage(i18n.lang, '/')}
            class="text-base w-1/4 min-w-fit rounded-full"
        >
            <House size="18" />
            {i18n._('homepage.home')}
        </Button>
        <Button
            data-sveltekit-reload
            href={getURLForLanguage(i18n.lang, '/app')}
            class="text-base w-1/4 min-w-fit rounded-full"
        >
            <Map size="18" />
            {i18n._('homepage.app')}
        </Button>
        <Button
            href={getURLForLanguage(i18n.lang, '/help')}
            class="text-base w-1/4 min-w-fit rounded-full"
        >
            <BookOpenText size="18" />
            <span>{i18n._('menu.help')}</span>
        </Button>
    </div>
</div>
