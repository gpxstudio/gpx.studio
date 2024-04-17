<script lang="ts">
	import { parseGPX } from 'gpx';

	import * as Menubar from '$lib/components/ui/menubar/index.js';

	import { Upload } from 'lucide-svelte';

	import { files } from '$lib/stores';

	let input: HTMLInputElement;

	$: if (input) {
		input.onchange = () => {
			if (input.files) {
				for (let i = 0; i < input.files.length; i++) {
					const file = input.files[i];
					const reader = new FileReader();
					reader.onload = () => {
						$files = [...$files, parseGPX(reader.result?.toString() ?? '')];
					};
					reader.readAsText(file);
				}
			}
		};
	}
</script>

<Menubar.Item
	on:click={() => {
		if (input) {
			input.click();
		}
	}}
>
	<Upload size="16" class="mr-1" /> Load from desktop... <Menubar.Shortcut>⌘O</Menubar.Shortcut>
</Menubar.Item>

<input bind:this={input} type="file" accept=".gpx" multiple class="hidden" />
