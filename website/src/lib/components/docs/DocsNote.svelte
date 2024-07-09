<script lang="ts">
	export let type: 'note' | 'warning' = 'note';
</script>

<div
	class="bg-accent border-l-8 {type === 'note'
		? 'border-blue-500'
		: 'border-destructive'} p-2 text-sm rounded-md"
>
	<slot />
</div>
