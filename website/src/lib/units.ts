import { get } from 'svelte/store';
import { settings } from '$lib/db';
import { _ } from 'svelte-i18n';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

export function kilometersToMiles(value: number) {
    return value * 0.621371;
}

export function metersToFeet(value: number) {
    return value * 3.28084;
}

export function celsiusToFahrenheit(value: number) {
    return value * 1.8 + 32;
}

export function distancePerHourToSecondsPerDistance(value: number) {
    return 3600 / value;
}

export function secondsToHHMMSS(value: number) {
    var hours = Math.floor(value / 3600);
    var minutes = Math.floor(value / 60) % 60;
    var seconds = Math.round(value % 60);

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
export function getDistanceUnits() {
    return get(distanceUnits) === 'metric' ? get(_)('units.kilometers') : get(_)('units.miles');
}

export function getVelocityUnits() {
    if (get(velocityUnits) === 'speed') {
        return get(distanceUnits) === 'metric' ? get(_)('units.kilometers_per_hour') : get(_)('units.miles_per_hour');
    } else {
        return get(distanceUnits) === 'metric' ? get(_)('units.minutes_per_kilometer') : get(_)('units.minutes_per_mile');

    }
}

export function getElevationUnits() {
    return get(distanceUnits) === 'metric' ? get(_)('units.meters') : get(_)('units.feet');
}

export function getHeartRateUnits() {
    return get(_)('units.heartrate');
}

export function getCadenceUnits() {
    return get(_)('units.cadence');
}

export function getPowerUnits() {
    return get(_)('units.power');
}

export function getTemperatureUnits() {
    return get(temperatureUnits) === 'celsius' ? get(_)('units.celsius') : get(_)('units.fahrenheit');
}

// Convert only the value
export function getConvertedDistance(value: number) {
    return get(distanceUnits) === 'metric' ? value : kilometersToMiles(value);
}

export function getConvertedElevation(value: number) {
    return get(distanceUnits) === 'metric' ? value : metersToFeet(value);
}

export function getConvertedVelocity(value: number) {
    if (get(velocityUnits) === 'speed') {
        return get(distanceUnits) === 'metric' ? value : kilometersToMiles(value);
    } else {
        return get(distanceUnits) === 'metric' ? distancePerHourToSecondsPerDistance(value) : distancePerHourToSecondsPerDistance(kilometersToMiles(value));
    }
}

export function getConvertedTemperature(value: number) {
    return get(temperatureUnits) === 'celsius' ? value : celsiusToFahrenheit(value);
}