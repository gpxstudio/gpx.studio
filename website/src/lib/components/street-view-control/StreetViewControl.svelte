<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import { Toggle } from '$lib/components/ui/toggle';
	import { PersonStanding } from 'lucide-svelte';
	import { MapillaryLayer } from './Mapillary';
	import { GoogleRedirect } from './Google';
	import { map, streetViewEnabled } from '$lib/stores';
	import { settings } from '$lib/db';

	const { streetViewSource } = settings;

	let googleRedirect: GoogleRedirect;
	let mapillaryLayer: MapillaryLayer;

	$: if ($map) {
		googleRedirect = new GoogleRedirect($map);
		mapillaryLayer = new MapillaryLayer($map);
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
