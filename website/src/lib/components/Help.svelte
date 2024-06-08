<script>
	import { CircleHelp } from 'lucide-svelte';
</script>

<div class="{$$props.class || ''} text-sm rounded border flex flex-row items-center p-2">
	<CircleHelp size="16" class="w-4 mr-2 shrink-0 grow-0" />
	<slot />
</div>
