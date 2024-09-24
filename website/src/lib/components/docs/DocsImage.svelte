<script lang="ts">
	export let img: 'getting-started/interface' | 'tools/routing' | 'tools/split';
	export let alt: string;
</script>

<div class="flex flex-col items-center py-6 w-full">
	<div class="rounded-md overflow-hidden overflow-clip shadow-xl mx-auto">
		{#if img === 'getting-started/interface'}
			<enhanced:img
				src="/src/lib/assets/img/docs/getting-started/interface.png"
				{alt}
				class="w-full max-w-3xl"
			/>
		{:else if img === 'tools/routing'}
			<enhanced:img
				src="/src/lib/assets/img/docs/tools/routing.png"
				{alt}
				class="w-full max-w-3xl"
			/>
		{:else if img === 'tools/split'}
			<enhanced:img src="/src/lib/assets/img/docs/tools/split.png" {alt} class="w-full max-w-3xl" />
		{/if}
	</div>
	<p class="text-center text-sm text-muted-foreground mt-2">{alt}</p>
</div>
