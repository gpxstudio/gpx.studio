<script lang="ts">
    import { Input } from '$lib/components/ui/input';

    let {
        id,
        value = $bindable(),
        disabled,
        oninput = () => {},
        onchange = () => {},
        onkeypress = () => {},
        onfocusin = () => {},
        class: className,
    }: {
        id: string;
        value: string | number;
        disabled?: boolean;
        oninput?: (e: Event) => void;
        onchange?: (e: Event) => void;
        onkeypress?: (e: KeyboardEvent) => void;
        onfocusin?: (e: FocusEvent) => void;
        class?: string;
    } = $props();
</script>

<div>
    <Input
        {id}
        type="text"
        step={1}
        bind:value
        {disabled}
        {oninput}
        {onchange}
        {onkeypress}
        onfocusin={(e) => {
            let input = document.activeElement;
            if (input instanceof HTMLInputElement) {
                input.select();
            }
            onfocusin(e);
        }}
        class="w-[22px] {className ?? ''}"
    />
</div>

<style lang="postcss">
    @reference "tailwindcss";

    div :global(input) {
        @apply px-0.5;
        @apply py-0;
        @apply bg-transparent;
        @apply text-right;
        @apply border-none;
        @apply shadow-none;
        @apply focus:ring-0;
        @apply focus:ring-offset-0;
        @apply focus:outline-none;
        @apply focus-visible:ring-0;
        @apply focus-visible:ring-offset-0;
        @apply focus-visible:outline-none;
    }
</style>
