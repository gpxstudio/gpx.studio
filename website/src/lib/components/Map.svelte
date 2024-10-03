<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

	import { Button } from '$lib/components/ui/button';
	import { map } from '$lib/stores';
	import { settings } from '$lib/db';
	import { _ } from 'svelte-i18n';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import { page } from '$app/stores';

	export let accessToken = PUBLIC_MAPBOX_TOKEN;
	export let geolocate = true;
	export let geocoder = true;
	export let hash = true;

	mapboxgl.accessToken = accessToken;

	let webgl2Supported = true;
	let fitBoundsOptions: mapboxgl.FitBoundsOptions = {
		maxZoom: 15,
		linear: true,
		easing: () => 1
	};

	const { distanceUnits, elevationProfile, verticalFileView, bottomPanelSize, rightPanelSize } =
		settings;
	let scaleControl = new mapboxgl.ScaleControl({
		unit: $distanceUnits
	});

	onMount(() => {
		let gl = document.createElement('canvas').getContext('webgl2');
		if (!gl) {
			webgl2Supported = false;
			return;
		}

		let language = $page.params.language;
		if (language === 'zh') {
			language = 'zh-Hans';
		} else if (language?.includes('-')) {
			language = language.split('-')[0];
		} else if (language === '' || language === undefined) {
			language = 'en';
		}

		const loadJson = mapboxgl.Style.prototype._load;
		mapboxgl.Style.prototype._load = function (json, validate) {
			if (
				json['sources'] &&
				json['sources']['mapbox-satellite'] &&
				json['sources']['mapbox-satellite']['data'] &&
				json['sources']['mapbox-satellite']['data']['data']
			) {
				// Temporary fix for https://github.com/gpxstudio/gpx.studio/issues/129
				delete json['sources']['mapbox-satellite']['data']['data'];
			}
			loadJson.call(this, json, validate);
		};

		let newMap = new mapboxgl.Map({
			container: 'map',
			style: {
				version: 8,
				sources: {},
				layers: [],
				imports: [
					{
						id: 'glyphs-and-sprite', // make Mapbox glyphs and sprite available to other styles
						url: '',
						data: {
							version: 8,
							sources: {},
							layers: [],
							glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
							sprite: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/sprite?access_token=${PUBLIC_MAPBOX_TOKEN}`
						}
					},
					{
						id: 'basemap',
						url: ''
					},
					{
						id: 'overlays',
						url: '',
						data: {
							version: 8,
							sources: {},
							layers: []
						}
					}
				]
			},
			zoom: 0,
			hash: hash,
			language,
			attributionControl: false,
			logoPosition: 'bottom-right',
			boxZoom: false
		});
		newMap.on('load', () => {
			$map = newMap; // only set the store after the map has loaded
			window._map = newMap; // entry point for extensions
			scaleControl.setUnit($distanceUnits);
		});

		newMap.addControl(
			new mapboxgl.AttributionControl({
				compact: true
			})
		);

		newMap.addControl(
			new mapboxgl.NavigationControl({
				visualizePitch: true
			})
		);

		if (geocoder) {
			let geocoder = new MapboxGeocoder({
				mapboxgl: mapboxgl,
				enableEventLogging: false,
				collapsed: true,
				flyTo: fitBoundsOptions,
				language,
				localGeocoder: () => [],
				localGeocoderOnly: true,
				externalGeocoder: (query: string) =>
					fetch(
						`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&accept-language=${language}`
					)
						.then((response) => response.json())
						.then((data) => {
							return data.map((result: any) => {
								return {
									type: 'Feature',
									geometry: {
										type: 'Point',
										coordinates: [result.lon, result.lat]
									},
									place_name: result.display_name
								};
							});
						})
			});
			let onKeyDown = geocoder._onKeyDown;
			geocoder._onKeyDown = (e: KeyboardEvent) => {
				// Trigger search on Enter key only
				if (e.key === 'Enter') {
					onKeyDown.apply(geocoder, [{ target: geocoder._inputEl }]);
				} else if (geocoder._typeahead.data.length > 0) {
					geocoder._typeahead.clear();
				}
			};
			newMap.addControl(geocoder);
		}

		if (geolocate) {
			newMap.addControl(
				new mapboxgl.GeolocateControl({
					positionOptions: {
						enableHighAccuracy: true
					},
					fitBoundsOptions,
					trackUserLocation: true,
					showUserHeading: true
				})
			);
		}

		newMap.addControl(scaleControl);

		newMap.on('style.load', () => {
			newMap.addSource('mapbox-dem', {
				type: 'raster-dem',
				url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
				tileSize: 512,
				maxzoom: 14
			});
			if (newMap.getPitch() > 0) {
				newMap.setTerrain({
					source: 'mapbox-dem',
					exaggeration: 1
				});
			}
			newMap.setFog({
				color: 'rgb(186, 210, 235)',
				'high-color': 'rgb(36, 92, 223)',
				'horizon-blend': 0.1,
				'space-color': 'rgb(156, 240, 255)'
			});
			newMap.on('pitch', () => {
				if (newMap.getPitch() > 0) {
					newMap.setTerrain({
						source: 'mapbox-dem',
						exaggeration: 1
					});
				} else {
					newMap.setTerrain(null);
				}
			});
		});
	});

	onDestroy(() => {
		if ($map) {
			$map.remove();
			$map = null;
		}
	});

	$: if (
		$map &&
		(!$verticalFileView || !$elevationProfile || $bottomPanelSize || $rightPanelSize)
	) {
		$map.resize();
	}
</script>

<div {...$$restProps}>
	<div id="map" class="h-full {webgl2Supported ? '' : 'hidden'}"></div>
	<div
		class="flex flex-col items-center justify-center gap-3 h-full {webgl2Supported ? 'hidden' : ''}"
	>
		<p>{$_('webgl2_required')}</p>
		<Button href="https://get.webgl.org/webgl2/" target="_blank">
			{$_('enable_webgl2')}
		</Button>
	</div>
</div>

<style lang="postcss">
	div :global(.mapboxgl-map) {
		@apply font-sans;
	}

	div :global(.mapboxgl-ctrl-top-right > .mapboxgl-ctrl) {
		@apply shadow-md;
		@apply bg-background;
		@apply text-foreground;
	}

	div :global(.mapboxgl-ctrl-icon) {
		@apply dark:brightness-[4.7];
	}

	div :global(.mapboxgl-ctrl-geocoder) {
		@apply flex;
		@apply flex-row;
		@apply w-fit;
		@apply min-w-fit;
		@apply items-center;
		@apply shadow-md;
	}

	div :global(.suggestions) {
		@apply shadow-md;
		@apply bg-background;
		@apply text-foreground;
	}

	div :global(.mapboxgl-ctrl-geocoder .suggestions > li > a) {
		@apply text-foreground;
		@apply hover:text-accent-foreground;
		@apply hover:bg-accent;
	}

	div :global(.mapboxgl-ctrl-geocoder .suggestions > .active > a) {
		@apply bg-background;
	}

	div :global(.mapboxgl-ctrl-geocoder--button) {
		@apply bg-transparent;
		@apply hover:bg-transparent;
	}

	div :global(.mapboxgl-ctrl-geocoder--icon) {
		@apply fill-foreground;
		@apply hover:fill-accent-foreground;
	}

	div :global(.mapboxgl-ctrl-geocoder--icon-search) {
		@apply relative;
		@apply top-0;
		@apply left-0;
		@apply my-2;
		@apply w-[29px];
	}

	div :global(.mapboxgl-ctrl-geocoder--input) {
		@apply relative;
		@apply w-64;
		@apply py-0;
		@apply pl-2;
		@apply focus:outline-none;
		@apply transition-[width];
		@apply duration-200;
		@apply text-foreground;
	}

	div :global(.mapboxgl-ctrl-geocoder--collapsed .mapboxgl-ctrl-geocoder--input) {
		@apply w-0;
		@apply p-0;
	}

	div :global(.mapboxgl-ctrl-top-right) {
		@apply z-40;
		@apply flex;
		@apply flex-col;
		@apply items-end;
		@apply h-full;
		@apply overflow-hidden;
	}

	.horizontal :global(.mapboxgl-ctrl-bottom-left) {
		@apply bottom-[42px];
	}

	.horizontal :global(.mapboxgl-ctrl-bottom-right) {
		@apply bottom-[42px];
	}

	div :global(.mapboxgl-ctrl-attrib) {
		@apply dark:bg-transparent;
	}

	div :global(.mapboxgl-compact-show.mapboxgl-ctrl-attrib) {
		@apply dark:bg-background;
	}

	div :global(.mapboxgl-ctrl-attrib-button) {
		@apply dark:bg-foreground;
	}

	div :global(.mapboxgl-compact-show .mapboxgl-ctrl-attrib-button) {
		@apply dark:bg-foreground;
	}

	div :global(.mapboxgl-ctrl-attrib a) {
		@apply text-foreground;
	}

	div :global(.mapboxgl-popup) {
		@apply w-fit;
		@apply z-50;
	}

	div :global(.mapboxgl-popup-content) {
		@apply p-0;
		@apply bg-transparent;
		@apply shadow-none;
	}

	div :global(.mapboxgl-popup-anchor-top .mapboxgl-popup-tip) {
		@apply border-b-background;
	}

	div :global(.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip) {
		@apply border-b-background;
	}

	div :global(.mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip) {
		@apply border-b-background;
	}

	div :global(.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip) {
		@apply border-t-background;
		@apply drop-shadow-md;
	}

	div :global(.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip) {
		@apply border-t-background;
		@apply drop-shadow-md;
	}

	div :global(.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip) {
		@apply border-t-background;
		@apply drop-shadow-md;
	}

	div :global(.mapboxgl-popup-anchor-left .mapboxgl-popup-tip) {
		@apply border-r-background;
	}

	div :global(.mapboxgl-popup-anchor-right .mapboxgl-popup-tip) {
		@apply border-l-background;
	}
</style>
