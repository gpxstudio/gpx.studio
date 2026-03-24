<script lang="ts">
    import { untrack } from 'svelte';
    import TimeComponentInput from './TimeComponentInput.svelte';

    let {
        showHours = true,
        value = $bindable(),
        disabled = false,
        onChange = () => {},
    }: {
        showHours?: boolean;
        value?: number;
        disabled?: boolean;
        onChange?: () => void;
    } = $props();

    let hours: string | number = $state('--');
    let minutes: string | number = $state('--');
    let seconds: string | number = $state('--');

    function maybeParseInt(value: string | number): number {
        if (value === '--' || value === '') {
            return 0;
        }
        const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    function isEmptyValue(value: string | number) {
        return value === '--' || value === '';
    }

    function computeValue(): number | undefined {
        if (isEmptyValue(hours) && isEmptyValue(minutes) && isEmptyValue(seconds)) {
            return undefined;
        }

        return Math.max(
            maybeParseInt(hours) * 3600 + maybeParseInt(minutes) * 60 + maybeParseInt(seconds),
            1
        );
    }

    function getDigits(value: string | number): string {
        return value.toString().replace(/\D/g, '');
    }

    function normalizeHours(value: string | number) {
        const digits = getDigits(value);
        if (digits === '') {
            return '';
        }
        return Math.max(parseInt(digits, 10), 0);
    }

    function normalizeTimeUnit(value: string | number, max: number, padLength: number) {
        const digits = getDigits(value);
        if (digits === '') {
            return '';
        }

        const parsed = Math.min(Math.max(parseInt(digits, 10), 0), max);
        return parsed.toString().padStart(padLength, '0');
    }

    $effect(() => {
        const val = computeValue();
        untrack(() => {
            value = val;
        });
    });

    $effect(() => {
        if (value === undefined) {
            untrack(() => {
                hours = '--';
                minutes = '--';
                seconds = '--';
            });
        } else {
            untrack(() => {
                if (value != computeValue()) {
                    let rounded = Math.max(Math.round(value!), 1);
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
            });
        }
    });

    let container: HTMLDivElement;
    let countKeyPress = 0;
    function onKeyPress(e: KeyboardEvent) {
        const target = e.target as HTMLInputElement | null;
        if (target && ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
            countKeyPress++;
            if (countKeyPress === 2) {
                const nextInput =
                    target.id === 'hours'
                        ? (container.querySelector('#minutes') as HTMLInputElement)
                        : target.id === 'minutes'
                          ? (container.querySelector('#seconds') as HTMLInputElement)
                          : null;
                if (nextInput) {
                    nextInput.focus();
                }
            }
        }
    }
</script>

<div
    bind:this={container}
    class="h-9 flex flex-row items-center w-full min-w-fit border rounded-md px-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 {disabled
        ? 'opacity-50 cursor-not-allowed'
        : ''}"
>
    {#if showHours}
        <TimeComponentInput
            id="hours"
            bind:value={hours}
            {disabled}
            class="w-[30px]"
            oninput={() => {
                hours = normalizeHours(hours);
                onChange();
            }}
            onkeypress={onKeyPress}
            onfocusin={() => {
                countKeyPress = 0;
            }}
        />
        <span class="text-sm">:</span>
    {/if}
    <TimeComponentInput
        id="minutes"
        bind:value={minutes}
        {disabled}
        oninput={() => {
            minutes = normalizeTimeUnit(minutes, showHours ? 59 : Number.MAX_SAFE_INTEGER, showHours ? 2 : 1);
            onChange();
        }}
        onkeypress={onKeyPress}
        onfocusin={() => {
            countKeyPress = 0;
        }}
    />
    <span class="text-sm">:</span>
    <TimeComponentInput
        id="seconds"
        bind:value={seconds}
        {disabled}
        oninput={() => {
            seconds = normalizeTimeUnit(seconds, 59, 2);
            onChange();
        }}
        onkeypress={onKeyPress}
        onfocusin={() => {
            countKeyPress = 0;
        }}
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
        appearance: textfield;
        -moz-appearance: textfield;
    }
</style>
