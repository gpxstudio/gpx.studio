<script lang="ts">
    import { isMac, isSafari } from '$lib/utils';
    import { onMount } from 'svelte';
    import { _ } from 'svelte-i18n';

    export let key: string;
    export let shift: boolean = false;
    export let ctrl: boolean = false;
    export let click: boolean = false;

    let mac = false;
    let safari = false;

    onMount(() => {
        mac = isMac();
        safari = isSafari();
    });
</script>

<div
    class="ml-auto pl-2 text-xs tracking-widest text-muted-foreground flex flex-row gap-0 items-baseline"
>
    <span>{shift ? '⇧' : ''}</span>
    <span>{ctrl ? (mac && !safari ? '⌘' : $_('menu.ctrl') + '+') : ''}</span>
    <span class={key === '+' ? 'font-medium text-sm/4' : ''}>{key}</span>
    <span>{click ? $_('menu.click') : ''}</span>
</div>
