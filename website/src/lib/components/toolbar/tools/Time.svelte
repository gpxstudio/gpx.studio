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
    import {
        ListFileItem,
        ListRootItem,
        ListTrackItem,
        ListTrackSegmentItem,
    } from '$lib/components/file-list/file-list';
    import Help from '$lib/components/Help.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { selection } from '$lib/logic/selection';
    import { settings } from '$lib/logic/settings';
    import { fileActionManager } from '$lib/logic/file-action-manager';
    import { gpxStatistics } from '$lib/logic/statistics';

    let props: {
        class?: string;
    } = $props();

    let startDate: DateValue | undefined = $state(undefined);
    let startTime: string | undefined = $state(undefined);
    let endDate: DateValue | undefined = $state(undefined);
    let endTime: string | undefined = $state(undefined);
    let movingTime: number | undefined = $state(undefined);
    let speed: number | undefined = $state(undefined);
    let artificial = $state(false);

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
        if ($gpxStatistics.global.time.start) {
            startDate = toCalendarDate($gpxStatistics.global.time.start);
            startTime = toTimeString($gpxStatistics.global.time.start);
        } else {
            startDate = undefined;
            startTime = undefined;
        }
        if ($gpxStatistics.global.time.end) {
            endDate = toCalendarDate($gpxStatistics.global.time.end);
            endTime = toTimeString($gpxStatistics.global.time.end);
        } else {
            endDate = undefined;
            endTime = undefined;
        }
        if ($gpxStatistics.global.time.moving && $gpxStatistics.global.speed.moving) {
            movingTime = $gpxStatistics.global.time.moving;
            setSpeed($gpxStatistics.global.speed.moving);
        } else if ($gpxStatistics.global.time.total && $gpxStatistics.global.speed.total) {
            movingTime = $gpxStatistics.global.time.total;
            setSpeed($gpxStatistics.global.speed.total);
        } else {
            movingTime = undefined;
            speed = undefined;
        }
    }

    $effect(() => {
        if ($gpxStatistics && $velocityUnits && $distanceUnits) {
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

    function updateEnd() {
        if (startDate && movingTime !== undefined) {
            if (startTime === undefined) {
                startTime = '00:00:00';
            }
            let start = getDate(startDate, startTime);
            let ratio =
                $gpxStatistics.global.time.moving > 0
                    ? $gpxStatistics.global.time.total / $gpxStatistics.global.time.moving
                    : 1;
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
            let ratio =
                $gpxStatistics.global.time.moving > 0
                    ? $gpxStatistics.global.time.total / $gpxStatistics.global.time.moving
                    : 1;
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

        let distance =
            $gpxStatistics.global.distance.moving > 0
                ? $gpxStatistics.global.distance.moving
                : $gpxStatistics.global.distance.total;
        movingTime = (distance / speedValue) * 3600;

        updateEnd();
    }

    function updateDataFromTotalTime() {
        if (movingTime === undefined) {
            return;
        }
        let distance =
            $gpxStatistics.global.distance.moving > 0
                ? $gpxStatistics.global.distance.moving
                : $gpxStatistics.global.distance.total;
        setSpeed(distance / (movingTime / 3600));
        updateEnd();
    }

    let canUpdate = $derived(
        $selection.size === 1 && $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints'])
    );
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <fieldset class="flex flex-col gap-2">
        <div class="flex flex-row gap-2 justify-center">
            <div class="flex flex-col gap-2 grow">
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
            <div class="flex flex-col gap-2 grow">
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
        <Label class="flex flex-row">
            <CirclePlay size="16" />
            {i18n._('toolbar.time.start')}
        </Label>
        <div class="flex flex-row gap-2">
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
        <Label class="flex flex-row">
            <CircleStop size="16" />
            {i18n._('toolbar.time.end')}
        </Label>
        <div class="flex flex-row gap-2">
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
        {#if $gpxStatistics.global.time.moving === 0 || $gpxStatistics.global.time.moving === undefined}
            <div class="mt-0.5 flex flex-row gap-1 items-center">
                <Checkbox id="artificial-time" bind:checked={artificial} disabled={!canUpdate} />
                <Label for="artificial-time">
                    {i18n._('toolbar.time.artificial')}
                </Label>
            </div>
        {/if}
    </fieldset>
    <div class="flex flex-row gap-2 items-center">
        <Button
            variant="outline"
            disabled={!canUpdate}
            class="grow whitespace-normal h-fit"
            onclick={() => {
                let effectiveSpeed = getSpeed();
                if (
                    startDate === undefined ||
                    startTime === undefined ||
                    effectiveSpeed === undefined ||
                    movingTime === undefined
                ) {
                    return;
                }

                if (Math.abs(effectiveSpeed - $gpxStatistics.global.speed.moving) < 0.01) {
                    effectiveSpeed = $gpxStatistics.global.speed.moving;
                }

                let ratio = 1;
                if (
                    $gpxStatistics.global.speed.moving > 0 &&
                    $gpxStatistics.global.speed.moving !== effectiveSpeed
                ) {
                    ratio = $gpxStatistics.global.speed.moving / effectiveSpeed;
                }

                let item = $selection.getSelected()[0];
                let fileId = item.getFileId();
                fileActionManager.applyToFile(fileId, (file) => {
                    if (item instanceof ListFileItem) {
                        if (artificial || !$gpxStatistics.global.time.moving) {
                            file.createArtificialTimestamps(
                                getDate(startDate!, startTime!),
                                movingTime!
                            );
                        } else {
                            file.changeTimestamps(
                                getDate(startDate!, startTime!),
                                effectiveSpeed,
                                ratio
                            );
                        }
                    } else if (item instanceof ListTrackItem) {
                        if (artificial || !$gpxStatistics.global.time.moving) {
                            file.createArtificialTimestamps(
                                getDate(startDate!, startTime!),
                                movingTime!,
                                item.getTrackIndex()
                            );
                        } else {
                            file.changeTimestamps(
                                getDate(startDate!, startTime!),
                                effectiveSpeed,
                                ratio,
                                item.getTrackIndex()
                            );
                        }
                    } else if (item instanceof ListTrackSegmentItem) {
                        if (artificial || !$gpxStatistics.global.time.moving) {
                            file.createArtificialTimestamps(
                                getDate(startDate!, startTime!),
                                movingTime!,
                                item.getTrackIndex(),
                                item.getSegmentIndex()
                            );
                        } else {
                            file.changeTimestamps(
                                getDate(startDate!, startTime!),
                                effectiveSpeed,
                                ratio,
                                item.getTrackIndex(),
                                item.getSegmentIndex()
                            );
                        }
                    }
                });
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
