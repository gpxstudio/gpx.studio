<script>
	import '../app.pcss';

	import { ModeWatcher } from 'mode-watcher';
	import { isLoading } from 'svelte-i18n';
</script>

<ModeWatcher />

{#if !$isLoading}
	<slot />
{/if}
