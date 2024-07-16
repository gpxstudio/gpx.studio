<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import { Toggle } from '$lib/components/ui/toggle';
	import { PersonStanding, X } from 'lucide-svelte';
	import { MapillaryLayer } from './Mapillary';
	import { GoogleRedirect } from './Google';
	import { map, streetViewEnabled } from '$lib/stores';
	import { settings } from '$lib/db';

	const { streetViewSource } = settings;

	let googleRedirect: GoogleRedirect;
	let mapillaryLayer: MapillaryLayer;
	let container: HTMLElement;

	$: if ($map) {
		googleRedirect = new GoogleRedirect($map);
		mapillaryLayer = new MapillaryLayer($map, container);
	}

	$: if (mapillaryLayer) {
		if ($streetViewSource === 'mapillary') {
			googleRedirect.remove();
			if ($streetViewEnabled) {
				mapillaryLayer.add();
			} else {
				mapillaryLayer.remove();
			}
		} else {
			mapillaryLayer.remove();
			if ($streetViewEnabled) {
				googleRedirect.add();
			} else {
				googleRedirect.remove();
			}
		}
	}
</script>

<CustomControl class="w-[29px] h-[29px] shrink-0">
	<Toggle bind:pressed={$streetViewEnabled} class="w-full h-full rounded p-0">
		<PersonStanding size="22" />
	</Toggle>
</CustomControl>

<div
	bind:this={container}
	class="hidden relative w-[50vw] h-[40vh] rounded-md border-background border-2"
>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="absolute top-0 right-0 z-10 bg-background p-1 rounded-bl-md cursor-pointer"
		on:click={() => {
			if (mapillaryLayer) {
				mapillaryLayer.closePopup();
			}
		}}
	>
		<X size="16" />
	</div>
</div>
