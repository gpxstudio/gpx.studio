<script lang="ts">
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
</script>

<Menu />
<div class="flex flex-col w-screen h-screen">
	<Map class="grow" />
	<div class="h-1/3">Test</div>
</div>
