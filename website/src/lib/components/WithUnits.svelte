<script lang="ts">
	import { settings } from '$lib/stores';
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
</script>

{#if type === 'distance'}
	{#if $settings.distanceUnits === 'metric'}
		{value.toFixed(2)} {$_('units.kilometers')}
	{:else}
		{kilometersToMiles(value).toFixed(2)} {$_('units.miles')}
	{/if}
{:else if type === 'elevation'}
	{#if $settings.distanceUnits === 'metric'}
		{value.toFixed(0)} {$_('units.meters')}
	{:else}
		{metersToFeet(value).toFixed(0)} {$_('units.feet')}
	{/if}
{:else if type === 'speed'}
	{#if $settings.distanceUnits === 'metric'}
		{#if $settings.velocityUnits === 'speed'}
			{value.toFixed(2)} {$_('units.kilometers_per_hour')}
		{:else}
			{secondsToHHMMSS(distancePerHourToSecondsPerDistance(value))}
			{$_('units.minutes_per_kilometer')}
		{/if}
	{:else if $settings.velocityUnits === 'speed'}
		{kilometersToMiles(value).toFixed(2)} {$_('units.miles_per_hour')}
	{:else}
		{secondsToHHMMSS(distancePerHourToSecondsPerDistance(kilometersToMiles(value)))}
		{$_('units.minutes_per_mile')}
	{/if}
{:else if type === 'temperature'}
	{#if $settings.temperatureUnits === 'celsius'}
		{value} {$_('units.celsius')}
	{:else}
		{celsiusToFahrenheit(value)} {$_('units.fahrenheit')}
	{/if}
{:else if type === 'time'}
	{secondsToHHMMSS(value)}
{/if}
