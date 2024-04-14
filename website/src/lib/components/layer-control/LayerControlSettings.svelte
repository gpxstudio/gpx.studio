<script lang="ts">
	import LayerTree from './LayerTree.svelte';

	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Accordion from '$lib/components/ui/accordion';

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
		<Sheet.Header class="h-full">
			<Sheet.Title>Layer settings</Sheet.Title>
			<Sheet.Description>
				Select the map layers you want to show in the interface and adjust their settings.
			</Sheet.Description>
			<Accordion.Root class="flex flex-col overflow-hidden">
				<Accordion.Item value="item-1" class="flex flex-col overflow-hidden">
					<Accordion.Trigger>Layer selection</Accordion.Trigger>
					<Accordion.Content class="grow flex flex-col">
						<ScrollArea class="pr-4">
							<LayerTree
								layerTree={basemapTree}
								label="Basemaps"
								name="basemapSettings"
								multiple={true}
								onValueChange={(id) => {
									// TODO
								}}
							/>
						</ScrollArea>
						<Separator class="my-2" />
						<ScrollArea class="pr-4">
							<LayerTree
								layerTree={overlayTree}
								label="Overlays"
								name="overlaySettings"
								multiple={true}
								onValueChange={(id, checked) => {
									// TODO
								}}
							/>
						</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>Custom layer</Accordion.Trigger>
					<Accordion.Content>
						<ScrollArea>TODO custom layer form</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>Heatmap settings</Accordion.Trigger>
					<Accordion.Content></Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-4">
					<Accordion.Trigger>POIs settings</Accordion.Trigger>
					<Accordion.Content></Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</Sheet.Header>
	</Sheet.Content>
</Sheet.Root>
