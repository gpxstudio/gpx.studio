<script lang="ts">
	import { CircleHelp } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';

	export let link: string | undefined = undefined;
</script>

<div
	class="text-sm bg-secondary rounded border flex flex-row items-center p-2 {$$props.class || ''}"
>
	<CircleHelp size="16" class="w-4 mr-2 shrink-0 grow-0" />
	<div>
		<slot />
		{#if link}
			<a href={link} target="_blank" class="text-sm text-link hover:underline">
				{$_('menu.more')}
			</a>
		{/if}
	</div>
</div>
