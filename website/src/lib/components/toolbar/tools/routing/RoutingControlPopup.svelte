<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { canChangeStart } from './RoutingControls';
	import { CirclePlay, Trash2 } from 'lucide-svelte';

	import { _ } from 'svelte-i18n';

	export let element: HTMLElement;
</script>

<div bind:this={element} class="hidden">
	<Card.Root class="border-none shadow-md text-base">
		<Card.Content class="flex flex-col p-1">
			{#if $canChangeStart}
				<Button
					class="w-full px-2 py-1 h-6 justify-start"
					variant="ghost"
					on:click={() => element.dispatchEvent(new CustomEvent('change-start'))}
				>
					<CirclePlay size="16" class="mr-1" />
					{$_('toolbar.routing.start_loop_here')}
				</Button>
			{/if}
			<Button
				class="w-full px-2 py-1 h-6 justify-start"
				variant="ghost"
				on:click={() => element.dispatchEvent(new CustomEvent('delete'))}
			>
				<Trash2 size="16" class="mr-1" />
				{$_('menu.delete')}
				<Shortcut key="" shift={true} click={true} />
			</Button>
		</Card.Content>
	</Card.Root>
</div>
