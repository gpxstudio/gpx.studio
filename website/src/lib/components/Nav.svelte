<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import ModeSwitch from '$lib/components/ModeSwitch.svelte';
	import { BookOpenText, Home, Map } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
</script>

<nav class="w-full sticky top-0 bg-background z-10">
	<div class="mx-6 py-2 flex flex-row items-center border-b gap-4 md:gap-8">
		<a href="./" class="shrink-0">
			<Logo class="h-8 sm:hidden" iconOnly={true} />
			<Logo class="h-7 hidden sm:block" />
		</a>
		<Button variant="link" class="text-base px-0" href="./">
			<Home size="18" class="mr-1.5" />
			{$_('homepage.home')}
		</Button>
		<Button variant="link" class="text-base px-0" href="./app">
			<Map size="18" class="mr-1.5" />
			{$_('homepage.app')}
		</Button>
		<Button variant="link" class="text-base px-0" href="./documentation">
			<BookOpenText size="18" class="mr-1.5" />
			{$_('homepage.documentation')}
		</Button>
		<ModeSwitch class="ml-auto" />
	</div>
</nav>
