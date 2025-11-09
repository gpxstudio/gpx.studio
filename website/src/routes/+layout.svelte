<script lang="ts">
    import '../app.css';
    import { ModeWatcher } from 'mode-watcher';
    import { i18n } from '$lib/i18n.svelte';
    import { page } from '$app/state';
    import Nav from '$lib/components/Nav.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { onMount, type Snippet } from 'svelte';
    import { convertOldEmbeddingOptions } from '$lib/components/embedding/embedding';
    import { base } from '$app/paths';
    import { languages } from '$lib/languages';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { getURLForLanguage } from '$lib/utils';

    let {
        data,
        children,
    }: {
        data: {
            guideTitles: Record<string, string>;
        };
        children: Snippet;
    } = $props();

    const appRoutes = ['/[[language]]/app', '/[[language]]/embed'];

    onMount(() => {
        if (page.url.searchParams.has('embed')) {
            // convert old embedding options to new format and redirect to new embed page
            let folders = page.url.pathname.split('/');
            let locale =
                folders.indexOf('l') >= 0 ? (folders[folders.indexOf('l') + 1] ?? 'en') : 'en';
            window.location.href = `${getURLForLanguage(locale, '/embed')}?options=${encodeURIComponent(JSON.stringify(convertOldEmbeddingOptions(page.url.searchParams)))}`;
        }
    });

    $effect(() => {
        if (page.route.id?.includes('[[language]]')) {
            if (page.params.language) {
                let lang = page.params.language.replace('/', '');
                if (i18n.lang !== lang) {
                    if (languages.hasOwnProperty(lang)) {
                        i18n.lang = lang;
                    } else if (browser) {
                        goto(`${base}/404`);
                    }
                }
            } else if (i18n.lang !== 'en') {
                i18n.lang = 'en';
            }
        } else if (i18n.lang === '') {
            i18n.lang = 'en';
        }
    });

    $effect(() => {
        let title = `gpx.studio — ${i18n._(`metadata.${page.route.id?.replace('/[[language]]', '').split('/')[1] ?? 'home'}_title`)}`;
        if (page.params.guide) {
            document.title = `${title} | ${data.guideTitles[page.params.guide]}`;
        } else {
            document.title = title;
        }
    });

    let showNavAndFooter = $derived(page.route.id === null || !appRoutes.includes(page.route.id));
</script>

<ModeWatcher />

<div class="flex flex-col min-h-screen">
    {#if !i18n.isLoadingInitial}
        {#if showNavAndFooter}
            <Nav />
        {/if}
        <main class="grow flex flex-col">
            {@render children()}
        </main>
        {#if showNavAndFooter}
            <Footer />
        {/if}
    {/if}
</div>
