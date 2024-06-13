<script lang="ts">
	import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import TimePicker from '$lib/components/ui/time-picker/TimePicker.svelte';
	import { settings } from '$lib/db';
	import { gpxStatistics } from '$lib/stores';
	import {
		distancePerHourToSecondsPerDistance,
		getConvertedVelocity,
		kilometersToMiles
	} from '$lib/units';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { CirclePlay, CircleStop, CircleX, RefreshCw, Timer, Zap } from 'lucide-svelte';
	import { tick } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListRootItem } from '$lib/components/file-list/FileList';
	import Help from '$lib/components/Help.svelte';

	let startDate: DateValue | undefined = undefined;
	let startTime: string | undefined = undefined;
	let endDate: DateValue | undefined = undefined;
	let endTime: string | undefined = undefined;
	let totalTime: number | undefined = undefined;
	let speed: number | undefined = undefined;

	function toCalendarDate(date: Date): CalendarDate {
		return new CalendarDate(date.getFullYear(), date.getMonth(), date.getDate());
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
			startTime = $gpxStatistics.global.time.start.toLocaleTimeString();
		} else {
			startDate = undefined;
			startTime = undefined;
		}
		if ($gpxStatistics.global.time.end) {
			endDate = toCalendarDate($gpxStatistics.global.time.end);
			endTime = $gpxStatistics.global.time.end.toLocaleTimeString();
		} else {
			endDate = undefined;
			endTime = undefined;
		}
		if ($gpxStatistics.global.time.total) {
			totalTime = $gpxStatistics.global.time.total;
		} else {
			totalTime = undefined;
		}
		if ($gpxStatistics.global.speed.total) {
			setSpeed($gpxStatistics.global.speed.total);
		} else {
			speed = undefined;
		}
	}

	$: if ($gpxStatistics && $velocityUnits && $distanceUnits) {
		setGPXData();
	}

	function getDate(date: DateValue, time: string): Date {
		if (date === undefined) {
			return new Date();
		}
		let [hours, minutes, seconds] = time.split(':').map((x) => parseInt(x));
		return new Date(date.year, date.month, date.day, hours, minutes, seconds);
	}

	function updateEnd() {
		if (startDate && totalTime !== undefined) {
			if (startTime === undefined) {
				startTime = '00:00:00';
			}
			let start = getDate(startDate, startTime);
			let end = new Date(start.getTime() + totalTime * 1000);
			endDate = toCalendarDate(end);
			endTime = end.toLocaleTimeString();
		}
	}

	function updateStart() {
		if (endDate && totalTime !== undefined) {
			if (endTime === undefined) {
				endTime = '00:00:00';
			}
			let end = getDate(endDate, endTime);
			let start = new Date(end.getTime() - totalTime * 1000);
			startDate = toCalendarDate(start);
			startTime = start.toLocaleTimeString();
		}
	}

	function updateDataFromSpeed() {
		if (speed === undefined) {
			return;
		}

		let speedValue = speed;
		if ($velocityUnits === 'pace') {
			speedValue = distancePerHourToSecondsPerDistance(speed);
		}
		if ($distanceUnits === 'imperial') {
			speedValue = kilometersToMiles(speedValue);
		}

		totalTime = ($gpxStatistics.global.distance.total / speedValue) * 3600;

		updateEnd();
	}

	function updateDataFromTotalTime() {
		if (totalTime === undefined) {
			return;
		}
		setSpeed($gpxStatistics.global.distance.total / (totalTime / 3600));
		updateEnd();
	}

	$: canUpdate =
		$selection.size === 1 && $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints']);
</script>

<div class="flex flex-col gap-3 w-80">
	<fieldset class="flex flex-col gap-2">
		<div class="flex flex-row gap-2 justify-center">
			<div class="flex flex-col gap-2">
				<Label for="speed" class="flex flex-row">
					<Zap size="16" class="mr-1" />
					{#if $velocityUnits === 'speed'}
						{$_('quantities.speed')}
					{:else}
						{$_('quantities.pace')}
					{/if}
				</Label>
				<div class="flex flex-row gap-1 items-center">
					{#if $velocityUnits === 'speed'}
						<Input
							id="speed"
							type="number"
							step={0.01}
							min={0}
							disabled={!canUpdate}
							bind:value={speed}
							on:change={updateDataFromSpeed}
						/>
						<span class="text-sm shrink-0">
							{#if $distanceUnits === 'imperial'}
								{$_('units.miles_per_hour')}
							{:else}
								{$_('units.kilometers_per_hour')}
							{/if}
						</span>
					{:else}
						<TimePicker
							bind:value={speed}
							showHours={false}
							disabled={!canUpdate}
							on:change={updateDataFromSpeed}
						/>
						<span class="text-sm shrink-0">
							{#if $distanceUnits === 'imperial'}
								{$_('units.minutes_per_mile')}
							{:else}
								{$_('units.minutes_per_kilometer')}
							{/if}
						</span>
					{/if}
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="duration" class="flex flex-row">
					<Timer size="16" class="mr-1" />
					{$_('toolbar.time.total_time')}
				</Label>
				<TimePicker
					bind:value={totalTime}
					disabled={!canUpdate}
					on:change={updateDataFromTotalTime}
				/>
			</div>
		</div>
		<Label class="flex flex-row">
			<CirclePlay size="16" class="mr-1" />
			{$_('toolbar.time.start')}
		</Label>
		<div class="flex flex-row gap-2">
			<DatePicker
				bind:value={startDate}
				disabled={!canUpdate}
				locale={get(locale) ?? 'en'}
				placeholder={$_('toolbar.time.pick_date')}
				class="w-[211px]"
				onValueChange={async () => {
					await tick();
					updateEnd();
				}}
			/>
			<Input
				type="time"
				step={1}
				disabled={!canUpdate}
				bind:value={startTime}
				class="w-[100px]"
				on:input={updateEnd}
			/>
		</div>
		<Label class="flex flex-row">
			<CircleStop size="16" class="mr-1" />
			{$_('toolbar.time.end')}
		</Label>
		<div class="flex flex-row gap-2">
			<DatePicker
				bind:value={endDate}
				disabled={!canUpdate}
				locale={get(locale) ?? 'en'}
				placeholder={$_('toolbar.time.pick_date')}
				class="w-[211px]"
				onValueChange={async () => {
					await tick();
					updateStart();
				}}
			/>
			<Input
				type="time"
				step={1}
				disabled={!canUpdate}
				bind:value={endTime}
				class="w-[100px]"
				on:change={updateStart}
			/>
		</div>
		{#if $gpxStatistics.global.time.total === 0 || $gpxStatistics.global.time.total === undefined}
			<Label class="mt-0.5 flex flex-row gap-1 items-center">
				<Checkbox disabled={!canUpdate} />
				{$_('toolbar.time.artificial')}
			</Label>
		{/if}
	</fieldset>
	<div class="flex flex-row gap-2">
		<Button variant="outline" disabled={!canUpdate} class="grow" on:click={() => {}}>
			<RefreshCw size="16" class="mr-1" />
			{$_('toolbar.time.update')}
		</Button>
		<Button variant="outline" on:click={setGPXData}>
			<CircleX size="16" />
		</Button>
	</div>
	<Help>
		{#if canUpdate}
			{$_('toolbar.time.help')}
		{:else}
			{$_('toolbar.time.help_invalid_selection')}
		{/if}
	</Help>
</div>
