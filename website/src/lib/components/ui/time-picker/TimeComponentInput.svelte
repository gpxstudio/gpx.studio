<script lang="ts" module>
    /** Shown by an empty field: real text rather than a placeholder, so that it can be selected. */
    export const EMPTY_FIELD = '--';
</script>

<script lang="ts">
    import { cn, type WithElementRef } from '$lib/utils.js';
    import type { HTMLInputAttributes } from 'svelte/elements';

    let {
        ref = $bindable(null),
        value,
        class: className,
        ...restProps
    }: WithElementRef<Omit<HTMLInputAttributes, 'type' | 'value'>> & { value: string } = $props();

    // The padding of the fields of a native time input, which is larger in Firefox.
    const padding = 'px-px [@supports(-moz-appearance:none)]:px-[3px]';
</script>

<!-- The invisible copy of the text sizes the field to its exact width, like in a native time input. -->
<span class="relative inline-block">
    <span aria-hidden="true" class={cn('invisible block whitespace-pre', padding)}>
        {value || EMPTY_FIELD}
    </span>
    <input
        bind:this={ref}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        value={value || EMPTY_FIELD}
        class={cn(
            'absolute inset-0 w-full bg-transparent text-center outline-none',
            padding,
            className
        )}
        onfocus={(e) => e.currentTarget.select()}
        {...restProps}
    />
</span>
