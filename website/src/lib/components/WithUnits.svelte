<script lang="ts">
	import { settings } from '$lib/db';
	import {
		celsiusToFahrenheit,
		distancePerHourToSecondsPerDistance,
		kilometersToMiles,
		metersToFeet,
		secondsToHHMMSS
	} from '$lib/units';

	import { _ } from 'svelte-i18n';

	export let value: number;
	export let type: 'distance' | 'elevation' | 'speed' | 'temperature' | 'time';
	export let showUnits: boolean = true;

	const { distanceUnits, velocityUnits, temperatureUnits } = settings;
</script>

{#if type === 'distance'}
	{#if $distanceUnits === 'metric'}
		{value.toFixed(2)} {showUnits ? $_('units.kilometers') : ''}
	{:else}
		{kilometersToMiles(value).toFixed(2)} {showUnits ? $_('units.miles') : ''}
	{/if}
{:else if type === 'elevation'}
	{#if $distanceUnits === 'metric'}
		{value.toFixed(0)} {showUnits ? $_('units.meters') : ''}
	{:else}
		{metersToFeet(value).toFixed(0)} {showUnits ? $_('units.feet') : ''}
	{/if}
{:else if type === 'speed'}
	{#if $distanceUnits === 'metric'}
		{#if $velocityUnits === 'speed'}
			{value.toFixed(2)} {showUnits ? $_('units.kilometers_per_hour') : ''}
		{:else}
			{secondsToHHMMSS(distancePerHourToSecondsPerDistance(value))}
			{showUnits ? $_('units.minutes_per_kilometer') : ''}
		{/if}
	{:else if $velocityUnits === 'speed'}
		{kilometersToMiles(value).toFixed(2)} {showUnits ? $_('units.miles_per_hour') : ''}
	{:else}
		{secondsToHHMMSS(distancePerHourToSecondsPerDistance(kilometersToMiles(value)))}
		{showUnits ? $_('units.minutes_per_mile') : ''}
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
