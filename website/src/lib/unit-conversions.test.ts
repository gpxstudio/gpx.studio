import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    celsiusToFahrenheit,
    convertDistance,
    convertDistanceToKilometers,
    convertElevation,
    convertTemperature,
    convertVelocity,
    distancePerHourToSecondsPerDistance,
    kilometersToMiles,
    kilometersToNauticalMiles,
    metersToFeet,
    milesToKilometers,
    nauticalMilesToKilometers,
    secondsToHHMMSS,
} from './unit-conversions';

const close = (actual: number, expected: number, epsilon = 1e-9) =>
    assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not ${expected}`);

describe('unit conversions', () => {
    it('converts distances both ways', () => {
        close(kilometersToMiles(10), 6.21371);
        close(milesToKilometers(kilometersToMiles(42.195)), 42.195, 1e-3);
        close(kilometersToNauticalMiles(1.852), 1.852 * 0.539957);
        close(nauticalMilesToKilometers(kilometersToNauticalMiles(100)), 100, 0.01);
        close(metersToFeet(100), 328.084);
        close(celsiusToFahrenheit(0), 32);
        close(celsiusToFahrenheit(100), 212);
        close(celsiusToFahrenheit(-40), -40);
    });

    it('converts to the units that are asked for', () => {
        assert.equal(convertDistance(5, 'metric'), 5);
        close(convertDistance(5, 'imperial'), kilometersToMiles(5));
        close(convertDistance(5, 'nautical'), kilometersToNauticalMiles(5));
        assert.equal(convertDistanceToKilometers(5, 'metric'), 5);
        close(convertDistanceToKilometers(5, 'imperial'), milesToKilometers(5));
        close(convertDistanceToKilometers(5, 'nautical'), nauticalMilesToKilometers(5));
        // elevations are in feet only with the imperial units
        assert.equal(convertElevation(100, 'metric'), 100);
        assert.equal(convertElevation(100, 'nautical'), 100);
        close(convertElevation(100, 'imperial'), metersToFeet(100));
        assert.equal(convertTemperature(20, 'celsius'), 20);
        close(convertTemperature(20, 'fahrenheit'), 68);
    });

    it('converts speeds and paces', () => {
        assert.equal(convertVelocity(12, 'speed', 'metric'), 12);
        close(convertVelocity(12, 'speed', 'imperial'), kilometersToMiles(12));
        // a pace is the time it takes to go one unit of distance
        assert.equal(convertVelocity(12, 'pace', 'metric'), 300);
        close(convertVelocity(12, 'pace', 'imperial'), 3600 / kilometersToMiles(12));
        close(convertVelocity(12, 'pace', 'nautical'), 3600 / kilometersToNauticalMiles(12));
        // no speed is no pace, not infinity
        assert.equal(distancePerHourToSecondsPerDistance(0), 0);
        assert.equal(convertVelocity(0, 'pace', 'metric'), 0);
    });

    it('formats durations, without the hours when there are none', () => {
        assert.equal(secondsToHHMMSS(0), '00:00');
        assert.equal(secondsToHHMMSS(5), '00:05');
        assert.equal(secondsToHHMMSS(59), '00:59');
        assert.equal(secondsToHHMMSS(60), '01:00');
        assert.equal(secondsToHHMMSS(300), '05:00');
        assert.equal(secondsToHHMMSS(3599), '59:59');
        assert.equal(secondsToHHMMSS(3600), '01:00:00');
        assert.equal(secondsToHHMMSS(3725), '01:02:05');
        assert.equal(secondsToHHMMSS(36000 + 61), '10:01:01');
        // the seconds are rounded, and never reach 60
        assert.equal(secondsToHHMMSS(61.4), '01:01');
        assert.equal(secondsToHHMMSS(119.9), '01:59');
    });
});
