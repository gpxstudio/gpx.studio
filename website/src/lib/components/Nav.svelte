<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import ModeSwitch from '$lib/components/ModeSwitch.svelte';
	import { BookOpenText, Home, Map } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';
	import { getURLForLanguage } from '$lib/utils';
</script>

<nav class="w-full sticky top-0 bg-background z-10">
	<div class="mx-6 py-2 flex flex-row items-center border-b gap-4 md:gap-8">
		<a href={getURLForLanguage('/[...language]', $locale)} class="shrink-0 translate-y-0.5">
			<Logo class="h-8 sm:hidden" iconOnly={true} />
			<Logo class="h-8 hidden sm:block" />
		</a>
		<Button
			variant="link"
			class="text-base px-0"
			href={getURLForLanguage('/[...language]', $locale)}
		>
			<Home size="18" class="mr-1.5" />
			{$_('homepage.home')}
		</Button>
		<Button
			variant="link"
			class="text-base px-0"
			href={getURLForLanguage('/[...language]/app', $locale)}
		>
			<Map size="18" class="mr-1.5" />
			{$_('homepage.app')}
		</Button>
		<Button
			variant="link"
			class="text-base px-0"
			href={getURLForLanguage('/[...language]/help', $locale)}
		>
			<BookOpenText size="18" class="mr-1.5" />
			{$_('menu.help')}
		</Button>
		<ModeSwitch class="ml-auto" />
	</div>
</nav>
