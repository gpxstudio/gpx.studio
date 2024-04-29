<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	export let key: string;
	export let shift: boolean = false;
	export let ctrl: boolean = false;
	export let click: boolean = false;

	let isMac = false;

	onMount(() => {
		isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
	});
</script>

<span class="ml-auto pl-2 text-xs tracking-widest text-muted-foreground"
	>{shift ? '⇧' : ''}{ctrl ? (isMac ? '⌘' : $_('menu.ctrl') + '+') : ''}{key}{click
		? $_('menu.click')
		: ''}</span
>
