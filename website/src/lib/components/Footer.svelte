<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import LanguageSelect from '$lib/components/LanguageSelect.svelte';
    import Logo from '$lib/components/Logo.svelte';
    import { AtSign, BookOpenText, Heart, Home, Map } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
</script>

<footer class="w-full">
    <div class="mx-6 border-t">
        <div class="mx-12 py-10 flex flex-row flex-wrap justify-between gap-x-10 gap-y-6">
            <div class="grow flex flex-col items-start">
                <Logo class="h-8" width="153" />
                <Button
                    variant="link"
                    class="h-6 px-0 text-muted-foreground"
                    href="https://github.com/gpxstudio/gpx.studio/blob/main/LICENSE"
                    target="_blank"
                >
                    MIT © 2025 gpx.studio
                </Button>
                <LanguageSelect class="w-40 mt-3" />
            </div>
            <div class="grow max-w-2xl flex flex-row flex-wrap justify-between gap-x-10 gap-y-6">
                <div class="flex flex-col items-start gap-1">
                    <span class="font-semibold">{i18n._('homepage.website')}</span>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href={getURLForLanguage(i18n.lang, '/')}
                    >
                        <Home size="16" />
                        {i18n._('homepage.home')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href={getURLForLanguage(i18n.lang, '/app')}
                    >
                        <Map size="16" />
                        {i18n._('homepage.app')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href={getURLForLanguage(i18n.lang, '/help')}
                    >
                        <BookOpenText size="16" />
                        {i18n._('menu.help')}
                    </Button>
                </div>
                <div class="flex flex-col items-start gap-1" id="contact">
                    <span class="font-semibold">{i18n._('homepage.contact')}</span>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://www.reddit.com/r/gpxstudio/"
                        target="_blank"
                    >
                        <Logo company="reddit" class="h-4 fill-muted-foreground" />
                        {i18n._('homepage.reddit')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://facebook.com/gpx.studio"
                        target="_blank"
                    >
                        <Logo company="facebook" class="h-4 fill-muted-foreground" />
                        {i18n._('homepage.facebook')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://x.com/gpxstudio"
                        target="_blank"
                    >
                        <Logo company="x" class="h-4 fill-muted-foreground" />
                        {i18n._('homepage.x')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="mailto:hello@gpx.studio"
                        target="_blank"
                    >
                        <AtSign size="16" />
                        {i18n._('homepage.email')}
                    </Button>
                </div>
                <div class="flex flex-col items-start gap-1">
                    <span class="font-semibold">{i18n._('homepage.contribute')}</span>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://ko-fi.com/gpxstudio"
                        target="_blank"
                    >
                        <Heart size="16" />
                        {i18n._('menu.donate')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://crowdin.com/project/gpxstudio"
                        target="_blank"
                    >
                        <Logo company="crowdin" class="h-4 fill-muted-foreground" />
                        {i18n._('homepage.crowdin')}
                    </Button>
                    <Button
                        variant="link"
                        class="h-6 px-0 text-muted-foreground"
                        href="https://github.com/gpxstudio/gpx.studio"
                        target="_blank"
                    >
                        <Logo company="github" class="h-4 fill-muted-foreground" />
                        {i18n._('homepage.github')}
                    </Button>
                </div>
            </div>
        </div>
    </div>
</footer>
