<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	export let key: string;
	export let shift: boolean = false;
	export let ctrl: boolean = false;
	export let click: boolean = false;

	let isMac = false;
	let isSafari = false;

	onMount(() => {
		isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
		isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
	});
</script>

<div
	class="ml-auto pl-2 text-xs tracking-widest text-muted-foreground flex flex-row gap-0 items-baseline"
>
	<span>{shift ? '⇧' : ''}</span>
	<span>{ctrl ? (isMac && !isSafari ? '⌘' : $_('menu.ctrl') + '+') : ''}</span>
	<span class={key === '+' ? 'font-medium text-sm/4' : ''}>{key}</span>
	<span>{click ? $_('menu.click') : ''}</span>
</div>
