<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Trash2 } from 'lucide-svelte';

	import { _ } from 'svelte-i18n';

	export let element: HTMLElement;
</script>

<div bind:this={element} class="hidden">
	<Card.Root class="border-none shadow-md text-base">
		<Card.Content class="flex flex-col p-1">
			<Button
				class="w-full px-2 py-1 h-6 justify-start"
				variant="ghost"
				on:click={() => element.dispatchEvent(new CustomEvent('delete'))}
				><Trash2 size="16" class="mr-1" /> {$_('menu.delete')}</Button
			>
		</Card.Content>
	</Card.Root>
</div>
