<script lang="ts">
    import docsearch from '@docsearch/js';
    import '@docsearch/css';
    import { onMount } from 'svelte';
    import { i18n } from '$lib/i18n.svelte';

    let props: {
        class?: string;
    } = $props();

    let mounted = false;

    function initDocsearch() {
        docsearch({
            appId: '21XLD94PE3',
            apiKey: 'd2c1ed6cb0ed12adb2bd84eb2a38494d',
            indexName: 'gpx',
            container: '#docsearch',
            searchParameters: {
                facetFilters: ['lang:' + i18n.lang],
            },
            placeholder: i18n._('docs.search.search'),
            disableUserPersonalization: true,
            translations: {
                button: {
                    buttonText: i18n._('docs.search.search'),
                    buttonAriaLabel: i18n._('docs.search.search'),
                },
                modal: {
                    searchBox: {
                        resetButtonTitle: i18n._('docs.search.clear'),
                        resetButtonAriaLabel: i18n._('docs.search.clear'),
                        cancelButtonText: i18n._('docs.search.cancel'),
                        cancelButtonAriaLabel: i18n._('docs.search.cancel'),
                        searchInputLabel: i18n._('docs.search.search'),
                    },
                    footer: {
                        selectText: i18n._('docs.search.to_select'),
                        navigateText: i18n._('docs.search.to_navigate'),
                        closeText: i18n._('docs.search.to_close'),
                    },
                    noResultsScreen: {
                        noResultsText: i18n._('docs.search.no_results'),
                        suggestedQueryText: i18n._('docs.search.no_results_suggestion'),
                    },
                },
            },
        });
    }

    onMount(() => {
        mounted = true;
    });

    $effect(() => {
        if (mounted && i18n.lang && !i18n.isLoading) {
            initDocsearch();
        }
    });
</script>

<svelte:head>
    <link rel="preconnect" href="https://21XLD94PE3-dsn.algolia.net" crossorigin />
</svelte:head>

<div id="docsearch" class={props.class ?? ''}></div>
