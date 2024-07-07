<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Moon, Sun } from 'lucide-svelte';
	import { mode, setMode, systemPrefersMode } from 'mode-watcher';
	import { _ } from 'svelte-i18n';

	export let size = '20';

	$: selectedMode = $mode ?? $systemPrefersMode ?? 'light';
</script>

<Button
	variant="ghost"
	class="h-8 px-1.5 {$$props.class ?? ''}"
	on:click={() => {
		setMode(selectedMode === 'light' ? 'dark' : 'light');
	}}
>
	{#if selectedMode === 'light'}
		<Sun {size} />
	{:else}
		<Moon {size} />
	{/if}
</Button>
