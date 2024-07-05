<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Moon, Sun } from 'lucide-svelte';
	import { mode, resetMode, setMode, systemPrefersMode } from 'mode-watcher';
	import { _ } from 'svelte-i18n';

	export let size = '20';
	let open = false;

	$: selectedMode = $mode ?? $systemPrefersMode ?? 'light';
</script>

<Popover.Root bind:open>
	<Popover.Trigger {...$$restProps}>
		{#if selectedMode === 'light'}
			<Sun {size} class="mr-1" />
		{:else}
			<Moon {size} class="mr-1" />
		{/if}
	</Popover.Trigger>
	<Popover.Content class=" w-fit flex flex-col p-2">
		{#each ['light', 'dark'] as m}
			<Button
				variant="ghost"
				class="h-8 justify-start"
				on:click={() => {
					setMode(m);
					open = false;
				}}>{$_(`menu.${m}`)}</Button
			>
		{/each}
	</Popover.Content>
</Popover.Root>
