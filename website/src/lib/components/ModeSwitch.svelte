<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Moon, Sun } from 'lucide-svelte';
	import { resetMode, setMode, systemPrefersMode } from 'mode-watcher';
	import { settings } from '$lib/db';
	import { _ } from 'svelte-i18n';

	const { mode } = settings;

	$: if ($mode === 'system') {
		resetMode();
	} else {
		setMode($mode);
	}

	export let size = '20';
	let open = false;
</script>

<Popover.Root bind:open>
	<Popover.Trigger {...$$restProps}>
		{#if $mode === 'system'}
			{#if $systemPrefersMode === 'light'}
				<Sun {size} class="mr-1" />
			{:else if $systemPrefersMode === 'dark'}
				<Moon {size} class="mr-1" />
			{:else}
				<Sun {size} class="mr-1" />
			{/if}
		{:else if $mode === 'light'}
			<Sun {size} class="mr-1" />
		{:else if $mode === 'dark'}
			<Moon {size} class="mr-1" />
		{/if}
	</Popover.Trigger>
	<Popover.Content class=" w-fit flex flex-col p-2">
		{#each ['light', 'dark', 'system'] as m}
			<Button
				variant="ghost"
				class="h-8 justify-start"
				on:click={() => {
					$mode = m;
					open = false;
				}}>{$_(`menu.${m}`)}</Button
			>
		{/each}
	</Popover.Content>
</Popover.Root>
