<script lang="ts">
	import { settings } from '$lib/db';
	import {
		celsiusToFahrenheit,
		getConvertedDistance,
		getConvertedElevation,
		getConvertedVelocity,
		getDistanceUnits,
		getElevationUnits,
		getVelocityUnits,
		secondsToHHMMSS
	} from '$lib/units';

	import { _ } from 'svelte-i18n';

	export let value: number;
	export let type: 'distance' | 'elevation' | 'speed' | 'temperature' | 'time';
	export let showUnits: boolean = true;
	export let decimals: number | undefined = undefined;

	const { distanceUnits, velocityUnits, temperatureUnits } = settings;
</script>

<span class={$$props.class}>
	{#if type === 'distance'}
		{getConvertedDistance(value, $distanceUnits).toFixed(decimals ?? 2)}
		{showUnits ? getDistanceUnits($distanceUnits) : ''}
	{:else if type === 'elevation'}
		{getConvertedElevation(value, $distanceUnits).toFixed(decimals ?? 2)}
		{showUnits ? getElevationUnits($distanceUnits) : ''}
	{:else if type === 'speed'}
		{#if $velocityUnits === 'speed'}
			{getConvertedVelocity(value, $velocityUnits, $distanceUnits).toFixed(decimals ?? 2)}
			{showUnits ? getVelocityUnits($velocityUnits, $distanceUnits) : ''}
		{:else}
			{secondsToHHMMSS(getConvertedVelocity(value, $velocityUnits, $distanceUnits))}
			{showUnits ? getVelocityUnits($velocityUnits, $distanceUnits) : ''}
		{/if}
	{:else if type === 'temperature'}
		{#if $temperatureUnits === 'celsius'}
			{value} {showUnits ? $_('units.celsius') : ''}
		{:else}
			{celsiusToFahrenheit(value)} {showUnits ? $_('units.fahrenheit') : ''}
		{/if}
	{:else if type === 'time'}
		{secondsToHHMMSS(value)}
	{/if}
</span>
