<script lang="ts">
	import TimeComponentInput from './TimeComponentInput.svelte';

	export let showHours = true;
	export let value: number | undefined = undefined;
	export let disabled: boolean = false;

	let hours: string | number = '--';
	let minutes: string | number = '--';
	let seconds: string | number = '--';

	function maybeParseInt(value: string | number): number {
		if (value === '--') {
			return 0;
		}
		return typeof value === 'string' ? parseInt(value) : value;
	}

	function computeValue() {
		return maybeParseInt(hours) * 3600 + maybeParseInt(minutes) * 60 + maybeParseInt(seconds);
	}

	function updateValue() {
		value = computeValue();
	}

	$: hours, minutes, seconds, updateValue();

	$: if (value === undefined) {
		hours = '--';
		minutes = '--';
		seconds = '--';
	} else if (value !== computeValue()) {
		let rounded = Math.round(value);
		if (showHours) {
			hours = Math.floor(rounded / 3600);
			minutes = Math.floor((rounded % 3600) / 60)
				.toString()
				.padStart(2, '0');
		} else {
			minutes = Math.floor(rounded / 60).toString();
		}
		seconds = (rounded % 60).toString().padStart(2, '0');
	}

	let container: HTMLDivElement;
	let countKeyPress = 0;
	function onKeyPress(e) {
		if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
			countKeyPress++;
			if (countKeyPress === 2) {
				if (e.target.id === 'hours') {
					container.querySelector('#minutes')?.focus();
				} else if (e.target.id === 'minutes') {
					container.querySelector('#seconds')?.focus();
				}
			}
		}
	}
</script>

<div
	bind:this={container}
	class="flex flex-row items-center w-fit border rounded-md px-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 {disabled
		? 'opacity-50 cursor-not-allowed'
		: ''}"
>
	{#if showHours}
		<TimeComponentInput
			id="hours"
			bind:value={hours}
			{disabled}
			class="w-[30px]"
			on:input={() => {
				if (typeof hours === 'string') {
					hours = parseInt(hours);
				}
				if (hours >= 0) {
				} else if (hours < 0) {
					hours = 0;
				} else {
					hours = 0;
				}
			}}
			on:keypress={onKeyPress}
			on:focusin={() => {
				countKeyPress = 0;
			}}
			on:change
		/>
		<span class="text-sm">:</span>
	{/if}
	<TimeComponentInput
		id="minutes"
		bind:value={minutes}
		{disabled}
		on:input={() => {
			if (typeof minutes === 'string') {
				minutes = parseInt(minutes);
			}
			if (minutes >= 0 && (minutes <= 59 || !showHours)) {
			} else if (minutes < 0) {
				minutes = 0;
			} else if (showHours && minutes > 59) {
				minutes = 59;
			} else {
				minutes = 0;
			}
			minutes = minutes.toString().padStart(showHours ? 2 : 1, '0');
		}}
		on:keypress={onKeyPress}
		on:focusin={() => {
			countKeyPress = 0;
		}}
		on:change
	/>
	<span class="text-sm">:</span>
	<TimeComponentInput
		id="seconds"
		bind:value={seconds}
		{disabled}
		on:input={() => {
			if (typeof seconds === 'string') {
				seconds = parseInt(seconds);
			}
			if (seconds >= 0 && seconds <= 59) {
			} else if (seconds < 0) {
				seconds = 0;
			} else if (seconds > 59) {
				seconds = 59;
			} else {
				seconds = 0;
			}
			seconds = seconds.toString().padStart(2, '0');
		}}
		on:keypress={onKeyPress}
		on:focusin={() => {
			countKeyPress = 0;
		}}
		on:change
	/>
</div>

<style>
	div :global(input::-webkit-outer-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}
	div :global(input::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}
	div :global(input[type='number']) {
		-moz-appearance: textfield;
	}
</style>
