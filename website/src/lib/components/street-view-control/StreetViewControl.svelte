<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { Toggle } from '$lib/components/ui/toggle';
	import { PersonStanding, X } from 'lucide-svelte';
	import { MapillaryLayer } from './Mapillary';
	import { GoogleRedirect } from './Google';
	import { map, streetViewEnabled } from '$lib/stores';
	import { settings } from '$lib/db';
	import { _ } from 'svelte-i18n';
	import { writable } from 'svelte/store';

	const { streetViewSource } = settings;

	let googleRedirect: GoogleRedirect;
	let mapillaryLayer: MapillaryLayer;
	let mapillaryOpen = writable(false);
	let container: HTMLElement;

	$: if ($map) {
		googleRedirect = new GoogleRedirect($map);
		mapillaryLayer = new MapillaryLayer($map, container, mapillaryOpen);
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
	<Tooltip class="w-full h-full" side="left" label={$_('menu.toggle_street_view')}>
		<Toggle
			bind:pressed={$streetViewEnabled}
			class="w-full h-full rounded p-0"
			aria-label={$_('menu.toggle_street_view')}
		>
			<PersonStanding size="22" />
		</Toggle>
	</Tooltip>
</CustomControl>

<div
	bind:this={container}
	class="{$mapillaryOpen
		? ''
		: 'hidden'} !absolute bottom-[44px] right-2.5 z-10 w-[40%] h-[40%] bg-background rounded-md overflow-hidden border-background border-2"
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
