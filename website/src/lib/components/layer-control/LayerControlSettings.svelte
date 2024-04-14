<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import LayerTree from './LayerTree.svelte';

	import { Button } from '$lib/components/ui/button';
	import Label from '$lib/components/ui/label/label.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Sheet from '$lib/components/ui/sheet';

	import Fa from 'svelte-fa';
	import { faGear } from '@fortawesome/free-solid-svg-icons';

	import {
		basemaps,
		basemapTree,
		overlays,
		overlayTree,
		opacities,
		defaultBasemap
	} from '$lib/assets/layers';
</script>

<Sheet.Root>
	<Sheet.Trigger class="w-full">
		<Button variant="secondary" class="w-full px-1 py-1.5">
			<Fa icon={faGear} class="mr-2" />
			Manage layers
		</Button>
	</Sheet.Trigger>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Layer settings</Sheet.Title>
			<Sheet.Description>
				Select the map layers you want to show in the interface and adjust their settings.
			</Sheet.Description>
		</Sheet.Header>
		<ScrollArea class="h-[35vh] pr-4">
			<div>
				<LayerTree
					layerTree={basemapTree}
					label="Basemaps"
					name="basemapSettings"
					multiple={true}
					onValueChange={(id) => {
						// TODO
					}}
				/>
			</div>
		</ScrollArea>
		<Separator class="my-2" />
		<ScrollArea class="h-[35vh] pr-4">
			<div>
				<LayerTree
					layerTree={overlayTree}
					label="Overlays"
					name="overlaySettings"
					multiple={true}
					onValueChange={(id, checked) => {
						// TODO
					}}
				/>
			</div>
		</ScrollArea>
		<Separator class="my-2" />
		<Button variant="secondary" class="w-full px-1 py-1.5">Add custom layer</Button>
	</Sheet.Content>
</Sheet.Root>
