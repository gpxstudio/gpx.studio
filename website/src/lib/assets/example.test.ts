import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeExampleData, engineIsBuilt } from '../scripts/example-statistics';
import { exampleData } from './example-data';
import { exampleStatistics } from './example';

describe('exampleStatistics', () => {
    it('has the statistics of the whole example for the whole range', () => {
        const whole = exampleStatistics.slice(0, exampleStatistics.length - 1);
        const global = exampleStatistics.global;
        assert.ok(whole);
        for (const key of [
            'totalDistance',
            'movingDistance',
            'totalTime',
            'movingTime',
            'elevationGain',
            'elevationLoss',
            'startTime',
            'endTime',
            'totalSpeed',
            'movingSpeed',
        ] as const) {
            assert.ok(Math.abs((whole[key] as number) - (global[key] as number)) < 1e-6, key);
        }
    });

    it('has no speed for a range that does not last', () => {
        const point = exampleStatistics.slice(20, 20);
        assert.equal(point?.totalTime, 0);
        assert.equal(point?.totalSpeed, undefined);
        assert.equal(point?.movingSpeed, undefined);
    });

    it('has nothing for ranges that are not in the example', () => {
        assert.equal(exampleStatistics.slice(5, 500), undefined);
        assert.equal(exampleStatistics.slice(-1, 3), undefined);
        assert.equal(exampleStatistics.slice(10, 5), undefined);
    });

    it(
        'is what the engine computes (npm run generate:example if not)',
        { skip: !engineIsBuilt() && 'the engine is not built' },
        async () => {
            assert.deepEqual(JSON.parse(JSON.stringify(await computeExampleData())), exampleData);
        }
    );
});
