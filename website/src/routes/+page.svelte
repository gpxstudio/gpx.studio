<script lang="ts">
	import Data from '$lib/components/Data.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import GPXData from '$lib/components/GPXData.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
</script>

<div class="flex flex-col w-screen h-screen">
	<div class="grow relative">
		<Menu />
		<Toolbar />
		<Map class="h-full" />
		<LayerControl />
		<Data />
	</div>
	<div class="h-60 flex flex-row">
		<FileList />
		<GPXData />
	</div>
</div>
