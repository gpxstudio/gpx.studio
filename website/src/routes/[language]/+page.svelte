<script lang="ts">
	import App from '$lib/components/App.svelte';

	import { locale } from 'svelte-i18n';
	import { page } from '$app/stores';

	locale.set($page.params.language);
</script>

<App />
