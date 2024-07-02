<script lang="ts">
	import { base } from '$app/paths';
	import { mode } from 'mode-watcher';
</script>

<a href="https://mapbox.com" target="_blank">
	<img
		src="{base}/mapbox-logo-{$mode === 'dark' ? 'white' : 'black'}.svg"
		alt="Logo of Mapbox."
		{...$$restProps}
	/>
</a>
