<script lang="ts">
	import { base } from '$app/paths';

	import { mode } from 'mode-watcher';

	export let iconOnly = false;
</script>

<img
	src="{base}/{iconOnly ? 'icon' : 'logo'}{$mode === 'dark' ? '-dark' : ''}.svg"
	alt="Logo of gpx.studio."
	{...$$restProps}
/>
