<script lang="ts">
    import { untrack } from 'svelte';
    import { cn } from '$lib/utils.js';
    import TimeComponentInput, { EMPTY_FIELD } from './TimeComponentInput.svelte';

    let {
        id,
        showHours = true,
        value = $bindable(),
        disabled = false,
        onChange = () => {},
    }: {
        /** Set on the first field, so that a label can target the picker. */
        id?: string;
        showHours?: boolean;
        value?: number;
        disabled?: boolean;
        onChange?: () => void;
    } = $props();

    let hours = $state('');
    let minutes = $state('');
    let seconds = $state('');

    let hoursInput: HTMLInputElement | null = $state(null);
    let minutesInput: HTMLInputElement | null = $state(null);
    let secondsInput: HTMLInputElement | null = $state(null);

    function parseField(field: string): number {
        return field === '' ? 0 : parseInt(field, 10);
    }

    function fieldsToSeconds(): number {
        const total =
            (showHours ? parseField(hours) * 3600 : 0) +
            parseField(minutes) * 60 +
            parseField(seconds);
        // Callers divide by this value, so it must stay positive.
        return Math.max(total, 1);
    }

    function pad(field: number): string {
        return field.toString().padStart(2, '0');
    }

    function showValue(newValue: number | undefined) {
        if (!Number.isFinite(newValue)) {
            hours = minutes = seconds = '';
            return;
        }
        const total = Math.max(Math.round(newValue!), 1);
        const totalMinutes = Math.floor(total / 60);
        if (showHours) {
            hours = Math.floor(total / 3600).toString();
            minutes = pad(totalMinutes % 60);
        } else {
            minutes = totalMinutes.toString();
        }
        seconds = pad(total % 60);
    }

    // Only the display follows `value`: it is written back on user input only, so that showing a
    // value never rounds or overwrites it. A value that matches the fields comes from them, and
    // must not reformat them during typing.
    $effect(() => {
        const newValue = value;
        void showHours;
        untrack(() => {
            if (newValue !== fieldsToSeconds()) {
                showValue(newValue);
            }
        });
    });

    /** A field without an upper bound: hours, or minutes when there are no hours. */
    function normalizeUnbounded(input: string): string {
        const digits = input.replace(/\D/g, '').slice(-6);
        return digits === '' ? '' : parseInt(digits, 10).toString();
    }

    /** Minutes or seconds: new digits shift in from the right, so "12" then "3" gives "23". */
    function normalizeSexagesimal(input: string): string {
        const digits = input.replace(/\D/g, '').slice(-2);
        return digits === '' ? '' : pad(Math.min(parseInt(digits, 10), 59));
    }

    let digitsTyped = 0;

    function handleInput(
        e: Event & { currentTarget: HTMLInputElement },
        normalize: (input: string) => string,
        setField: (field: string) => void,
        nextInput: HTMLInputElement | null
    ) {
        const input = e.currentTarget;
        const field = normalize(input.value);
        // The state is unchanged when the input is rejected (a letter, for example), in which case
        // Svelte would leave the rejected text in the DOM.
        input.value = field || EMPTY_FIELD;
        if (!field) {
            input.select();
        }
        setField(field);

        value = fieldsToSeconds();
        onChange();

        if (/^\d$/.test((e as unknown as InputEvent).data ?? '')) {
            digitsTyped++;
            if (digitsTyped === 2) {
                nextInput?.focus();
            }
        }
    }

    function handlePointerDown(e: PointerEvent) {
        // Like a native input, the whole box gives focus, not only the text.
        if (e.target === e.currentTarget) {
            e.preventDefault();
            (hoursInput ?? minutesInput)?.focus();
        }
    }

    function handleFocusOut(e: FocusEvent & { currentTarget: HTMLDivElement }) {
        // Fill in the fields left empty once the user is done with the picker.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            showValue(value);
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    data-slot="time-picker"
    class={cn(
        'dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 flex h-8 w-full min-w-28 cursor-text items-center justify-end rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors focus-within:ring-3 md:text-sm',
        disabled && 'bg-input/50 dark:bg-input/80 pointer-events-none cursor-not-allowed opacity-50'
    )}
    onpointerdown={handlePointerDown}
    onfocusin={() => {
        digitsTyped = 0;
    }}
    onfocusout={handleFocusOut}
>
    {#if showHours}
        <TimeComponentInput
            {id}
            bind:ref={hoursInput}
            value={hours}
            {disabled}
            oninput={(e) =>
                handleInput(e, normalizeUnbounded, (field) => (hours = field), minutesInput)}
        />
        <span>:</span>
    {/if}
    <TimeComponentInput
        id={showHours ? undefined : id}
        bind:ref={minutesInput}
        value={minutes}
        {disabled}
        oninput={(e) =>
            handleInput(
                e,
                showHours ? normalizeSexagesimal : normalizeUnbounded,
                (field) => (minutes = field),
                secondsInput
            )}
    />
    <span>:</span>
    <TimeComponentInput
        bind:ref={secondsInput}
        value={seconds}
        {disabled}
        oninput={(e) => handleInput(e, normalizeSexagesimal, (field) => (seconds = field), null)}
    />
</div>
