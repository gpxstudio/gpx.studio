<script lang="ts">
	import { languages } from '$lib/languages';
</script>

<!-- hidden links for svelte crawling -->
<div>
	{#each Object.entries(languages) as [lang, label]}
		{#if lang !== 'en'}
			<a href="./{lang}">
				{label}
			</a>
		{/if}
	{/each}
</div>
