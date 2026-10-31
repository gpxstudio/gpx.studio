// The conversions between units, with the units given: they do not depend on the settings (see
// `units.ts`, which converts to the units of the settings).

export type DistanceUnits = 'metric' | 'imperial' | 'nautical';
export type VelocityUnits = 'speed' | 'pace';
export type TemperatureUnits = 'celsius' | 'fahrenheit';

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

/** The pace (seconds per distance unit) of a speed (distance units per hour). 0 for no speed. */
export function distancePerHourToSecondsPerDistance(value: number) {
    if (value === 0) {
        return 0;
    }
    return 3600 / value;
}

/** A duration as `HH:MM:SS`, or `MM:SS` when it has no hours. */
export function secondsToHHMMSS(value: number) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor(value / 60) % 60;
    const seconds = Math.min(59, Math.round(value % 60));

    return [hours, minutes, seconds]
        .map((v) => (v < 10 ? '0' + v : v))
        .filter((v, i) => v !== '00' || i > 0)
        .join(':');
}

/** A distance in kilometers, in the given units. */
export function convertDistance(value: number, units: DistanceUnits) {
    switch (units) {
        case 'metric':
            return value;
        case 'imperial':
            return kilometersToMiles(value);
        case 'nautical':
            return kilometersToNauticalMiles(value);
    }
}

/** A distance in the given units, in kilometers. */
export function convertDistanceToKilometers(value: number, units: DistanceUnits) {
    switch (units) {
        case 'metric':
            return value;
        case 'imperial':
            return milesToKilometers(value);
        case 'nautical':
            return nauticalMilesToKilometers(value);
    }
}

/** An elevation in meters, in the units of the distances (nautical miles go with meters). */
export function convertElevation(value: number, units: DistanceUnits) {
    return units === 'imperial' ? metersToFeet(value) : value;
}

/** A speed in km/h, in the given units: a speed or a pace, per kilometer, mile or nautical mile. */
export function convertVelocity(
    value: number,
    velocityUnits: VelocityUnits,
    distanceUnits: DistanceUnits
) {
    const speed = convertDistance(value, distanceUnits);
    return velocityUnits === 'speed' ? speed : distancePerHourToSecondsPerDistance(speed);
}

/** A temperature in degrees Celsius, in the given units. */
export function convertTemperature(value: number, units: TemperatureUnits) {
    return units === 'celsius' ? value : celsiusToFahrenheit(value);
}
