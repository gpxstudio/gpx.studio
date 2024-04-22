<script lang="ts">
	import { flyAndScale } from '$lib/utils';
</script>

<div in:flyAndScale={{ x: -2, y: 0, duration: 100 }} class="translate-x-1 h-full">
	<div class="rounded-md shadow-md pointer-events-auto">
		<slot />
	</div>
</div>
