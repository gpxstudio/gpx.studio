<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Upload } from 'lucide-svelte';

	import { triggerFileInput } from '$lib/components/tools/tools';
</script>

<Menubar.Item on:click={triggerFileInput}>
	<Upload size="16" class="mr-1" /> Load from desktop... <Menubar.Shortcut>⌘O</Menubar.Shortcut>
</Menubar.Item>
