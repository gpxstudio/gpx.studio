<script lang="ts">
	import mapboxOutdoorsMap from '$lib/assets/img/home/mapbox-outdoors.png?enhanced';
	import waymarkedMap from '$lib/assets/img/home/waymarked.png?enhanced';
</script>

<div class="relative h-80 aspect-square rounded-2xl shadow-xl overflow-clip">
	<enhanced:img src={mapboxOutdoorsMap} alt="Mapbox Outdoors map screenshot." class="absolute" />
	<enhanced:img
		src={waymarkedMap}
		alt="Waymarked Trails map screenshot."
		class="absolute opacity-0 hover:opacity-100 transition-opacity duration-200"
	/>
</div>
