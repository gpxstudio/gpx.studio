<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { Checkbox } from '$lib/components/ui/checkbox';

	export let basemaps;
	export let overlays;

	export let onBasemapChange: (id: string) => void;
	export let onOverlayChange: (id: string, checked: boolean) => void;
</script>

<div class="hidden group-hover:block p-2 space-y-2">
	<RadioGroup.Root value="mapboxOutdoors" onValueChange={onBasemapChange}>
		{#each Object.keys(basemaps) as id}
			<div class="flex items-center space-x-2">
				<RadioGroup.Item value={id} {id} />
				<Label for={id}>{id}</Label>
			</div>
		{/each}
	</RadioGroup.Root>
	<div class="flex flex-col">
		{#each Object.keys(overlays) as id}
			<div>
				<Checkbox
					{id}
					onCheckedChange={(checked) => {
						onOverlayChange(id, checked === 'indeterminate' ? false : checked);
					}}
				/>
				<Label for={id}>{id}</Label>
			</div>
		{/each}
	</div>
</div>
