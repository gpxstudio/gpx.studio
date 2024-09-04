<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Logo from '$lib/components/Logo.svelte';
	import { getURLForLanguage } from '$lib/utils';
	import { Home, Map, BookOpenText } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';
</script>

<div class="grow px-12 my-12 flex flex-col items-center justify-center gap-6">
	<p class="text-7xl font-black">404</p>
	<p class="text-xl -mt-6">{$_('page_not_found')}</p>
	<Logo class="h-40 my-3 animate-spin" style="animation-duration: 20000ms" iconOnly={true} />
	<div class="w-full flex flex-row flex-wrap gap-3 justify-center">
		<Button href={getURLForLanguage($locale, '/')} class="text-base w-1/4 min-w-fit rounded-full">
			<Home size="18" class="mr-1.5" />
			{$_('homepage.home')}
		</Button>
		<Button
			href={getURLForLanguage($locale, '/app')}
			class="text-base w-1/4 min-w-fit rounded-full"
		>
			<Map size="18" class="mr-1.5" />
			{$_('homepage.app')}
		</Button>
		<Button
			href={getURLForLanguage($locale, '/help')}
			class="text-base w-1/4 min-w-fit rounded-full"
		>
			<BookOpenText size="18" class="mr-1.5" />
			<span>{$_('menu.help')}</span>
		</Button>
	</div>
</div>
