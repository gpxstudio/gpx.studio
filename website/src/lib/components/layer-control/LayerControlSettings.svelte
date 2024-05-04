<script lang="ts">
	import LayerTree from './LayerTree.svelte';

	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Accordion from '$lib/components/ui/accordion';

	import { Settings } from 'lucide-svelte';

	import { basemapTree, overlayTree, type CollapsedInfoTreeType } from '$lib/assets/layers';
	import { settings } from '$lib/db';

	import { _ } from 'svelte-i18n';

	const { selectedBasemapTree, selectedOverlayTree } = settings;

	let checkedBasemaps: CollapsedInfoTreeType<{ [key: string]: boolean }> = {
		self: {},
		children: {}
	};
	let checkedOverlays: CollapsedInfoTreeType<{ [key: string]: boolean }> = {
		self: {},
		children: {}
	};
</script>

<Sheet.Root>
	<Sheet.Trigger class="w-full">
		<Button variant="ghost" class="w-full px-1 py-1.5">
			<Settings size="18" class="mr-2" />
			{$_('layers.manage')}
		</Button>
	</Sheet.Trigger>
	<Sheet.Content>
		<Sheet.Header class="h-full">
			<Sheet.Title>{$_('layers.settings')}</Sheet.Title>
			<Sheet.Description>
				{$_('layers.settings_help')}
			</Sheet.Description>
			<Accordion.Root class="flex flex-col overflow-hidden">
				<Accordion.Item value="item-1" class="flex flex-col overflow-hidden">
					<Accordion.Trigger>{$_('layers.selection')}</Accordion.Trigger>
					<Accordion.Content class="grow flex flex-col border rounded">
						<ScrollArea class="py-2 pr-2">
							<LayerTree
								layerTree={basemapTree}
								name="basemapSettings"
								multiple={true}
								onValueChange={(id, checked) => {
									console.log('basemap', id, checked);
								}}
								bind:checked={checkedBasemaps}
							/>
						</ScrollArea>
						<Separator />
						<ScrollArea class="py-2 pr-2">
							<LayerTree
								layerTree={overlayTree}
								name="overlaySettings"
								multiple={true}
								onValueChange={(id, checked) => {
									console.log('overlay', id, checked);
								}}
								bind:checked={checkedOverlays}
							/>
						</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-2">
					<Accordion.Trigger>{$_('layers.custom_layers')}</Accordion.Trigger>
					<Accordion.Content>
						<ScrollArea>TODO custom layer list + new custom layer form</ScrollArea>
					</Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-3">
					<Accordion.Trigger>{$_('layers.heatmap')}</Accordion.Trigger>
					<Accordion.Content></Accordion.Content>
				</Accordion.Item>
				<Accordion.Item value="item-4">
					<Accordion.Trigger>{$_('layers.pois')}</Accordion.Trigger>
					<Accordion.Content></Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>
		</Sheet.Header>
	</Sheet.Content>
</Sheet.Root>
