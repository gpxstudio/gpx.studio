<script lang="ts">
	export let src;
	export let alt: string;
</script>

<div class="flex flex-col items-center py-6 w-full">
	<div class="rounded-md overflow-clip shadow-xl mx-auto">
		<enhanced:img {src} {alt} class="w-full max-w-3xl" />
	</div>
	<p class="text-center text-sm text-muted-foreground mt-2">{alt}</p>
</div>
