<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	import { _ } from 'svelte-i18n';

	export let element: HTMLElement;
</script>

<div bind:this={element} class="hidden">
	<Card.Root class="border-none shadow-md text-base">
		<Card.Content class="flex flex-col p-1">Waypoint info (TODO)</Card.Content>
	</Card.Root>
</div>
