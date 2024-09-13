<script lang="ts">
	import docsearch from '@docsearch/js';
	import '@docsearch/css';
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';

	let mounted = false;

	function initDocsearch() {
		docsearch({
			appId: '21XLD94PE3',
			apiKey: 'd2c1ed6cb0ed12adb2bd84eb2a38494d',
			indexName: 'gpx',
			container: '#docsearch',
			searchParameters: {
				facetFilters: ['lang:' + ($locale ?? 'en')]
			},
			placeholder: $_('docs.search.search'),
			translations: {
				button: {
					buttonText: $_('docs.search.search'),
					buttonAriaLabel: $_('docs.search.search')
				},
				modal: {
					searchBox: {
						resetButtonTitle: $_('docs.search.clear'),
						resetButtonAriaLabel: $_('docs.search.clear'),
						cancelButtonText: $_('docs.search.cancel'),
						cancelButtonAriaLabel: $_('docs.search.cancel'),
						searchInputLabel: $_('docs.search.search')
					},
					startScreen: {
						recentSearchesTitle: $_('docs.search.recent'),
						noRecentSearchesText: $_('docs.search.no_recent'),
						saveRecentSearchButtonTitle: $_('docs.search.save'),
						removeRecentSearchButtonTitle: $_('docs.search.remove'),
						favoriteSearchesTitle: $_('docs.search.favorites'),
						removeFavoriteSearchButtonTitle: $_('docs.search.remove_favorite')
					},
					footer: {
						selectText: $_('docs.search.to_select'),
						navigateText: $_('docs.search.to_navigate'),
						closeText: $_('docs.search.to_close')
					},
					noResultsScreen: {
						noResultsText: $_('docs.search.no_results'),
						suggestedQueryText: $_('docs.search.no_results_suggestion')
					}
				}
			}
		});
	}

	onMount(() => {
		mounted = true;
	});

	$: if (mounted && $locale) {
		initDocsearch();
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://21XLD94PE3-dsn.algolia.net" crossorigin />
</svelte:head>

<div id="docsearch" {...$$restProps}></div>
