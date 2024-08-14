<script lang="ts">
	import { locale, _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { languages } from '$lib/languages';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	$: if ($page.params.language === '' && $locale !== 'en') {
		locale.set('en');
	} else if ($page.params.language) {
		let lang = $page.params.language.replace('/', '');
		if ($locale !== lang) {
			if (languages.hasOwnProperty(lang)) {
				locale.set(lang);
			} else if (browser) {
				goto(`${base}/404`);
			}
		}
	}
</script>

<slot />
