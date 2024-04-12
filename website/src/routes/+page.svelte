<script lang="ts">
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
</script>

<div class="flex flex-col w-screen h-screen">
	<div class="grow relative">
		<Menu />
		<Toolbar />
		<Map class="h-full" />
	</div>
	<div class="h-12">Test</div>
</div>
