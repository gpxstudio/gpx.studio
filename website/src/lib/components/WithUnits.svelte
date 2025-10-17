<script lang="ts">
    import {
        celsiusToFahrenheit,
        getConvertedDistance,
        getConvertedElevation,
        getConvertedVelocity,
        getDistanceUnits,
        getElevationUnits,
        getVelocityUnits,
        secondsToHHMMSS,
    } from '$lib/units';
    import { i18n } from '$lib/i18n.svelte';
    import { settings } from '$lib/logic/settings';

    let {
        value,
        type,
        showUnits = true,
        decimals = undefined,
        class: className = '',
    }: {
        value: number;
        type: 'distance' | 'elevation' | 'speed' | 'temperature' | 'time';
        showUnits?: boolean;
        decimals?: number;
        class?: string;
    } = $props();

    const { distanceUnits, velocityUnits, temperatureUnits } = settings;
</script>

<span class={className}>
    {#if type === 'distance'}
        {getConvertedDistance(value, $distanceUnits).toFixed(decimals ?? 2)}
        {showUnits ? getDistanceUnits($distanceUnits) : ''}
    {:else if type === 'elevation'}
        {getConvertedElevation(value, $distanceUnits).toFixed(decimals ?? 0)}
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
            {value} {showUnits ? i18n._('units.celsius') : ''}
        {:else}
            {celsiusToFahrenheit(value)} {showUnits ? i18n._('units.fahrenheit') : ''}
        {/if}
    {:else if type === 'time'}
        {secondsToHHMMSS(value)}
    {/if}
</span>
