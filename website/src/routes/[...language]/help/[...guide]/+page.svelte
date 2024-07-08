<script lang="ts">
	import { page } from '$app/stores';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
</script>

<DocsLoader path="{$page.params.guide}.svx" />
