import { settings } from '$lib/logic/settings';
import { i18n } from '$lib/i18n.svelte';
import { get } from 'svelte/store';
import {
    convertDistance,
    convertDistanceToKilometers,
    convertElevation,
    convertTemperature,
    convertVelocity,
    secondsToHHMMSS,
} from '$lib/unit-conversions';

export * from '$lib/unit-conversions';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

// Get a string representation of the value with units
export function getDistanceWithUnits(value: number, convert: boolean = true) {
    if (convert) {
        return getConvertedDistance(value).toFixed(2) + ' ' + getDistanceUnits();
    } else {
        return value.toFixed(2) + ' ' + getDistanceUnits();
    }
}

export function getVelocityWithUnits(value: number, convert: boolean = true) {
    if (get(velocityUnits) === 'speed') {
        if (convert) {
            return getConvertedVelocity(value).toFixed(2) + ' ' + getVelocityUnits();
        } else {
            return value.toFixed(2) + ' ' + getVelocityUnits();
        }
    } else {
        if (convert) {
            return secondsToHHMMSS(getConvertedVelocity(value)) + ' ' + getVelocityUnits();
        } else {
            return secondsToHHMMSS(value) + ' ' + getVelocityUnits();
        }
    }
}

export function getElevationWithUnits(value: number, convert: boolean = true) {
    if (convert) {
        return getConvertedElevation(value).toFixed(0) + ' ' + getElevationUnits();
    } else {
        return value.toFixed(0) + ' ' + getElevationUnits();
    }
}

export function getHeartRateWithUnits(value: number) {
    return value.toFixed(0) + ' ' + getHeartRateUnits();
}

export function getCadenceWithUnits(value: number) {
    return value.toFixed(0) + ' ' + getCadenceUnits();
}

export function getPowerWithUnits(value: number) {
    return value.toFixed(0) + ' ' + getPowerUnits();
}

export function getTemperatureWithUnits(value: number, convert: boolean = true) {
    if (convert) {
        return getConvertedTemperature(value).toFixed(0) + ' ' + getTemperatureUnits();
    } else {
        return value.toFixed(0) + ' ' + getTemperatureUnits();
    }
}

// Get the units
export function getDistanceUnits(targetDistanceUnits = get(distanceUnits)) {
    switch (targetDistanceUnits) {
        case 'metric':
            return i18n._('units.kilometers');
        case 'imperial':
            return i18n._('units.miles');
        case 'nautical':
            return i18n._('units.nautical_miles');
    }
}

export function getVelocityUnits(
    targetVelocityUnits = get(velocityUnits),
    targetDistanceUnits = get(distanceUnits)
) {
    if (targetVelocityUnits === 'speed') {
        switch (targetDistanceUnits) {
            case 'metric':
                return i18n._('units.kilometers_per_hour');
            case 'imperial':
                return i18n._('units.miles_per_hour');
            case 'nautical':
                return i18n._('units.knots');
        }
    } else {
        switch (targetDistanceUnits) {
            case 'metric':
                return i18n._('units.minutes_per_kilometer');
            case 'imperial':
                return i18n._('units.minutes_per_mile');
            case 'nautical':
                return i18n._('units.minutes_per_nautical_mile');
        }
    }
}

export function getElevationUnits(targetDistanceUnits = get(distanceUnits)) {
    switch (targetDistanceUnits) {
        case 'metric':
            return i18n._('units.meters');
        case 'imperial':
            return i18n._('units.feet');
        case 'nautical':
            // See https://github.com/gpxstudio/gpx.studio/pull/66#issuecomment-2306568997
            return i18n._('units.meters');
    }
}

export function getHeartRateUnits() {
    return i18n._('units.heartrate');
}

export function getCadenceUnits() {
    return i18n._('units.cadence');
}

export function getPowerUnits() {
    return i18n._('units.power');
}

export function getTemperatureUnits() {
    return get(temperatureUnits) === 'celsius'
        ? i18n._('units.celsius')
        : i18n._('units.fahrenheit');
}

// Convert only the value, to the units of the settings by default
export function getConvertedDistance(value: number, targetDistanceUnits = get(distanceUnits)) {
    return convertDistance(value, targetDistanceUnits);
}

export function getConvertedDistanceToKilometers(
    value: number,
    sourceDistanceUnits = get(distanceUnits)
) {
    return convertDistanceToKilometers(value, sourceDistanceUnits);
}

export function getConvertedElevation(value: number, targetDistanceUnits = get(distanceUnits)) {
    return convertElevation(value, targetDistanceUnits);
}

export function getConvertedVelocity(
    value: number,
    targetVelocityUnits = get(velocityUnits),
    targetDistanceUnits = get(distanceUnits)
) {
    return convertVelocity(value, targetVelocityUnits, targetDistanceUnits);
}

export function getConvertedTemperature(
    value: number,
    targetTemperatureUnits = get(temperatureUnits)
) {
    return convertTemperature(value, targetTemperatureUnits);
}
