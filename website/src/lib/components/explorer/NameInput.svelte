<script lang="ts">
    let {
        value = '',
        placeholder,
        oncommit,
        oncancel,
    }: {
        value?: string;
        placeholder?: string;
        /** The name is given: with Enter (`enter`), or by leaving the field. */
        oncommit: (value: string, enter: boolean) => void;
        /** Escape: no name is given. */
        oncancel: () => void;
    } = $props();

    function onkeydown(event: KeyboardEvent) {
        // not for the row or the explorer it is in (a folder opens with Enter or Space, the selected
        // files open with Enter)
        event.stopPropagation();
        if (event.key === 'Enter') {
            oncommit((event.currentTarget as HTMLInputElement).value, true);
        } else if (event.key === 'Escape') {
            oncancel();
        }
    }
</script>

<!-- the name of a file or a folder of the explorer, being given or changed -->
<input
    class="h-6 grow min-w-0 px-1 text-sm font-normal not-italic bg-background border rounded outline-none"
    {value}
    {placeholder}
    {@attach (input) => {
        // once it is shown: it can be in a folder that is opening
        const frame = requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return () => cancelAnimationFrame(frame);
    }}
    {onkeydown}
    onkeyup={(event) => event.stopPropagation()}
    onclick={(event) => event.stopPropagation()}
    onblur={(event) => oncommit(event.currentTarget.value, false)}
/>
