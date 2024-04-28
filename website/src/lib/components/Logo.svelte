<script lang="ts">
	import { base } from '$app/paths';

	import { mode } from 'mode-watcher';
</script>

<img
	src="{base}/logo{$mode === 'dark' ? '-dark' : ''}.svg"
	alt="Logo of gpx.studio."
	{...$$restProps}
/>
