<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { languages } from '$lib/languages';
	import { BookOpenText, Info, Languages, Map } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';

	let selected = {
		value: '',
		label: ''
	};

	$: if ($locale) {
		selected = {
			value: $locale,
			label: languages[$locale]
		};
	}

	function getURLForLanguage(lang?: string): string {
		let currentPath = window.location.pathname;
		let currentPathArray = currentPath.split('/');

		if (currentPathArray.length > 1 && languages.hasOwnProperty(currentPathArray[1])) {
			currentPathArray.splice(1, 1);
		}

		if (lang !== undefined && lang !== 'en') {
			currentPathArray.splice(1, 0, lang);
		}

		return currentPathArray.join('/');
	}
</script>

<nav class="w-full sticky top-0 bg-background">
	<div class="mx-6 py-2 flex flex-row items-center border-b">
		<a href="./">
			<Logo class="h-6" />
		</a>
		<Button variant="link" class="text-base" href="./">
			<Map size="18" class="mr-1.5" />
			{$_('menu.app')}
		</Button>
		<Button variant="link" class="text-base" href="./about">
			<Info size="18" class="mr-1.5" />
			{$_('menu.about')}
		</Button>
		<Button variant="link" class="text-base" href="./documentation">
			<BookOpenText size="18" class="mr-1.5" />
			{$_('menu.documentation')}
		</Button>
		<Select.Root bind:selected onSelectedChange={(s) => goto(getURLForLanguage(s?.value))}>
			<Select.Trigger class="w-[180px] ml-auto">
				<Languages size="16" />
				<Select.Value class="ml-2 mr-auto" />
			</Select.Trigger>
			<Select.Content>
				{#each Object.entries(languages) as [key, value]}
					<Select.Item value={key}>{value}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
</nav>
