<script lang="ts">
    import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import TimePicker from '$lib/components/ui/time-picker/TimePicker.svelte';
    import {
        distancePerHourToSecondsPerDistance,
        getConvertedVelocity,
        milesToKilometers,
        nauticalMilesToKilometers,
    } from '$lib/units';
    import { CalendarDate, type DateValue } from '@internationalized/date';
    import { CalendarClock, CirclePlay, CircleStop, CircleX, Timer, Zap } from '@lucide/svelte';
    import { untrack } from 'svelte';
    import { i18n } from '$lib/i18n.svelte';
    import Help from '$lib/components/Help.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { settings } from '$lib/logic/settings';
    import { engine } from '$lib/engine';

    let props: {
        class?: string;
    } = $props();

    const selection = engine.selection;
    const statistics = engine.statistics;
    let global = $derived($statistics.global);

    let startDate: DateValue | undefined = $state(undefined);
    let startTime: string | undefined = $state(undefined);
    let endDate: DateValue | undefined = $state(undefined);
    let endTime: string | undefined = $state(undefined);
    let movingTime: number | undefined = $state(undefined);
    let speed: number | undefined = $state(undefined);
    let artificial = $state(true);

    function toCalendarDate(date: Date): CalendarDate {
        return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    function toTimeString(date: Date): string {
        return date.toTimeString().split(' ')[0];
    }

    const { velocityUnits, distanceUnits } = settings;

    function setSpeed(value: number) {
        let speedValue = getConvertedVelocity(value);
        if ($velocityUnits === 'speed') {
            speedValue = parseFloat(speedValue.toFixed(2));
        }
        speed = speedValue;
    }

    function setGPXData() {
        if (global.startTime !== undefined) {
            const start = new Date(global.startTime);
            startDate = toCalendarDate(start);
            startTime = toTimeString(start);
        } else {
            startDate = undefined;
            startTime = undefined;
        }
        if (global.endTime !== undefined) {
            const end = new Date(global.endTime);
            endDate = toCalendarDate(end);
            endTime = toTimeString(end);
        } else {
            endDate = undefined;
            endTime = undefined;
        }
        if (global.movingTime && global.movingSpeed) {
            movingTime = global.movingTime;
            setSpeed(global.movingSpeed);
        } else if (global.totalTime && global.totalSpeed) {
            movingTime = global.totalTime;
            setSpeed(global.totalSpeed);
        } else {
            movingTime = undefined;
            speed = undefined;
        }
    }

    $effect(() => {
        if ($statistics && $velocityUnits && $distanceUnits) {
            untrack(() => setGPXData());
        }
    });

    function getDate(date: DateValue, time: string): Date {
        if (date === undefined) {
            return new Date();
        }
        let [hours, minutes, seconds] = time.split(':').map((x) => parseInt(x));
        if (seconds === undefined) {
            seconds = 0;
        }
        return new Date(date.year, date.month - 1, date.day, hours, minutes, seconds);
    }

    /** Total time over moving time. */
    function timeRatio() {
        return global.movingTime && global.totalTime ? global.totalTime / global.movingTime : 1;
    }

    /** The distance to cover at the speed: the moving one if there is one. */
    function distance() {
        return global.movingDistance ? global.movingDistance : global.totalDistance;
    }

    function updateEnd() {
        if (startDate && movingTime !== undefined) {
            if (startTime === undefined) {
                startTime = '00:00:00';
            }
            let start = getDate(startDate, startTime);
            let ratio = timeRatio();
            let end = new Date(start.getTime() + ratio * movingTime * 1000);
            endDate = toCalendarDate(end);
            endTime = toTimeString(end);
        }
    }

    function updateStart() {
        if (endDate && movingTime !== undefined) {
            if (endTime === undefined) {
                endTime = '00:00:00';
            }
            let end = getDate(endDate, endTime);
            let ratio = timeRatio();
            let start = new Date(end.getTime() - ratio * movingTime * 1000);
            startDate = toCalendarDate(start);
            startTime = toTimeString(start);
        }
    }

    function getSpeed() {
        if (speed === undefined) {
            return undefined;
        }

        let speedValue = speed;
        if ($velocityUnits === 'pace') {
            speedValue = distancePerHourToSecondsPerDistance(speed);
        }
        if ($distanceUnits === 'imperial') {
            speedValue = milesToKilometers(speedValue);
        } else if ($distanceUnits === 'nautical') {
            speedValue = nauticalMilesToKilometers(speedValue);
        }
        return speedValue;
    }

    function updateDataFromSpeed() {
        let speedValue = getSpeed();
        if (speedValue === undefined) {
            return;
        }

        movingTime = (distance() / speedValue) * 3600;

        updateEnd();
    }

    function updateDataFromTotalTime() {
        if (movingTime === undefined) {
            return;
        }
        setSpeed(distance() / (movingTime / 3600));
        updateEnd();
    }

    // a single file, track or segment
    let canUpdate = $derived(
        ($selection.type === 'file' && $selection.fileIds.length === 1) ||
            ($selection.type === 'track' && $selection.trackIds.length === 1) ||
            ($selection.type === 'segment' && $selection.segmentIds.length === 1)
    );
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <fieldset class="flex flex-col gap-2">
        <div class="flex flex-row gap-1.5 justify-center">
            <div class="flex flex-col gap-1 grow">
                <Label for="speed" class="flex flex-row">
                    <Zap size="16" />
                    {#if $velocityUnits === 'speed'}
                        {i18n._('quantities.speed')}
                    {:else}
                        {i18n._('quantities.pace')}
                    {/if}
                </Label>
                <div class="flex flex-row gap-1 items-center">
                    {#if $velocityUnits === 'speed'}
                        <Input
                            id="speed"
                            type="number"
                            step={0.01}
                            min={0.01}
                            disabled={!canUpdate}
                            bind:value={speed}
                            onchange={() => {
                                untrack(() => updateDataFromSpeed());
                            }}
                            class="text-sm"
                        />
                        <span class="text-sm shrink-0">
                            {#if $distanceUnits === 'imperial'}
                                {i18n._('units.miles_per_hour')}
                            {:else if $distanceUnits === 'metric'}
                                {i18n._('units.kilometers_per_hour')}
                            {:else if $distanceUnits === 'nautical'}
                                {i18n._('units.knots')}
                            {/if}
                        </span>
                    {:else}
                        <TimePicker
                            bind:value={speed}
                            showHours={false}
                            disabled={!canUpdate}
                            onChange={() => {
                                untrack(() => updateDataFromSpeed());
                            }}
                        />
                        <span class="text-sm shrink-0">
                            {#if $distanceUnits === 'imperial'}
                                {i18n._('units.minutes_per_mile')}
                            {:else if $distanceUnits === 'metric'}
                                {i18n._('units.minutes_per_kilometer')}
                            {:else if $distanceUnits === 'nautical'}
                                {i18n._('units.minutes_per_nautical_mile')}
                            {/if}
                        </span>
                    {/if}
                </div>
            </div>
            <div class="flex flex-col gap-1 grow">
                <Label for="duration" class="flex flex-row">
                    <Timer size="16" />
                    {i18n._('toolbar.time.total_time')}
                </Label>
                <TimePicker
                    bind:value={movingTime}
                    disabled={!canUpdate}
                    onChange={() => {
                        untrack(() => updateDataFromTotalTime());
                    }}
                />
            </div>
        </div>
        <div class="flex flex-col gap-1">
            <Label class="flex flex-row">
                <CirclePlay size="16" />
                {i18n._('toolbar.time.start')}
            </Label>
            <div class="flex flex-row gap-1.5">
                <DatePicker
                    bind:value={startDate}
                    disabled={!canUpdate}
                    locale={i18n.lang}
                    placeholder={i18n._('toolbar.time.pick_date')}
                    class="w-fit grow"
                    onchange={() => {
                        untrack(() => updateEnd());
                    }}
                />
                <Input
                    type="time"
                    step={1}
                    disabled={!canUpdate}
                    bind:value={startTime}
                    class="w-fit"
                    onchange={() => {
                        untrack(() => updateEnd());
                    }}
                />
            </div>
        </div>
        <div class="flex flex-col gap-1">
            <Label class="flex flex-row">
                <CircleStop size="16" />
                {i18n._('toolbar.time.end')}
            </Label>
            <div class="flex flex-row gap-1.5">
                <DatePicker
                    bind:value={endDate}
                    disabled={!canUpdate}
                    locale={i18n.lang}
                    placeholder={i18n._('toolbar.time.pick_date')}
                    class="w-fit grow"
                    onchange={() => {
                        untrack(() => updateStart());
                    }}
                />
                <Input
                    type="time"
                    step={1}
                    disabled={!canUpdate}
                    bind:value={endTime}
                    class="w-fit"
                    onchange={() => {
                        untrack(() => updateStart());
                    }}
                />
            </div>
        </div>
        {#if !global.movingTime}
            <div class="mt-0.5 flex flex-row gap-1 items-center">
                <Checkbox id="artificial-time" bind:checked={artificial} disabled={!canUpdate} />
                <Label for="artificial-time">
                    {i18n._('toolbar.time.artificial')}
                </Label>
            </div>
        {/if}
    </fieldset>
    <div class="flex flex-row gap-1.5 items-center">
        <Button
            variant="outline"
            disabled={!canUpdate}
            class="grow shrink whitespace-normal h-fit min-h-8 py-1"
            onclick={() => {
                const speedValue = getSpeed();
                if (
                    startDate === undefined ||
                    startTime === undefined ||
                    speedValue === undefined ||
                    movingTime === undefined
                ) {
                    return;
                }

                let effectiveSpeed: number = speedValue;
                const movingSpeed = global.movingSpeed ?? 0;
                if (Math.abs(effectiveSpeed - movingSpeed) < 0.01) {
                    effectiveSpeed = movingSpeed;
                }

                let ratio = 1;
                if (movingSpeed > 0 && movingSpeed !== effectiveSpeed) {
                    ratio = movingSpeed / effectiveSpeed;
                }

                const start = getDate(startDate, startTime);
                if (artificial && !global.movingTime) {
                    engine.createArtificialTimestamps(start, movingTime);
                } else {
                    engine.changeTimestamps(start, effectiveSpeed, ratio);
                }
            }}
        >
            <CalendarClock size="16" class="shrink-0" />
            {i18n._('toolbar.time.update')}
        </Button>
        <Button variant="outline" size="icon" onclick={setGPXData}>
            <CircleX size="16" />
        </Button>
    </div>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/time')}>
        {#if canUpdate}
            {i18n._('toolbar.time.help')}
        {:else}
            {i18n._('toolbar.time.help_invalid_selection')}
        {/if}
    </Help>
</div>
