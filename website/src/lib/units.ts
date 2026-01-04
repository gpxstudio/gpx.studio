import { settings } from '$lib/logic/settings';
import { i18n } from '$lib/i18n.svelte';
import { get } from 'svelte/store';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

export function kilometersToMiles(value: number) {
    return value * 0.621371;
}

export function milesToKilometers(value: number) {
    return value * 1.60934;
}

export function metersToFeet(value: number) {
    return value * 3.28084;
}

export function kilometersToNauticalMiles(value: number) {
    return value * 0.539957;
}

export function nauticalMilesToKilometers(value: number) {
    return value * 1.852;
}

export function celsiusToFahrenheit(value: number) {
    return value * 1.8 + 32;
}

export function distancePerHourToSecondsPerDistance(value: number) {
    if (value === 0) {
        return 0;
    }
    return 3600 / value;
}

export function secondsToHHMMSS(value: number) {
    var hours = Math.floor(value / 3600);
    var minutes = Math.floor(value / 60) % 60;
    var seconds = Math.min(59, Math.round(value % 60));

    return [hours, minutes, seconds]
        .map((v) => (v < 10 ? '0' + v : v))
        .filter((v, i) => v !== '00' || i > 0)
        .join(':');
}

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

// Convert only the value
export function getConvertedDistance(value: number, targetDistanceUnits = get(distanceUnits)) {
    switch (targetDistanceUnits) {
        case 'metric':
            return value;
        case 'imperial':
            return kilometersToMiles(value);
        case 'nautical':
            return kilometersToNauticalMiles(value);
    }
}

export function getConvertedDistanceToKilometers(
    value: number,
    sourceDistanceUnits = get(distanceUnits)
) {
    switch (sourceDistanceUnits) {
        case 'metric':
            return value;
        case 'imperial':
            return milesToKilometers(value);
        case 'nautical':
            return nauticalMilesToKilometers(value);
    }
}

export function getConvertedElevation(value: number, targetDistanceUnits = get(distanceUnits)) {
    switch (targetDistanceUnits) {
        case 'metric':
            return value;
        case 'imperial':
            return metersToFeet(value);
        case 'nautical':
            return value;
    }
}

export function getConvertedVelocity(
    value: number,
    targetVelocityUnits = get(velocityUnits),
    targetDistanceUnits = get(distanceUnits)
) {
    if (targetVelocityUnits === 'speed') {
        switch (targetDistanceUnits) {
            case 'metric':
                return value;
            case 'imperial':
                return kilometersToMiles(value);
            case 'nautical':
                return kilometersToNauticalMiles(value);
        }
    } else {
        switch (targetDistanceUnits) {
            case 'metric':
                return distancePerHourToSecondsPerDistance(value);
            case 'imperial':
                return distancePerHourToSecondsPerDistance(kilometersToMiles(value));
            case 'nautical':
                return distancePerHourToSecondsPerDistance(kilometersToNauticalMiles(value));
        }
    }
}

export function getConvertedTemperature(
    value: number,
    targetTemperatureUnits = get(temperatureUnits)
) {
    return targetTemperatureUnits === 'celsius' ? value : celsiusToFahrenheit(value);
}
