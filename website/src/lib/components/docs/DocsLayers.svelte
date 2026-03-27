<script lang="ts">
    import maptilerTopoMap from '$lib/assets/img/home/maptiler-topo.png?enhanced';
    import waymarkedMap from '$lib/assets/img/home/waymarked.png?enhanced';
</script>

<div class="relative h-80 aspect-square rounded-2xl shadow-xl overflow-clip">
    <enhanced:img src={maptilerTopoMap} alt="MapTiler Topo map screenshot." class="absolute" />
    <enhanced:img
        src={waymarkedMap}
        alt="Waymarked Trails map screenshot."
        class="absolute opacity-0 hover:opacity-100 transition-opacity duration-200"
    />
</div>
