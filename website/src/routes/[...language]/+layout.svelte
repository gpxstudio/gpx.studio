<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { isLoading, locale, _ } from 'svelte-i18n';
	import { page } from '$app/stores';

	if ($page.params.language) {
		locale.set($page.params.language);
	}
</script>

<ModeWatcher />

{#if !$isLoading}
	<slot />
{/if}
