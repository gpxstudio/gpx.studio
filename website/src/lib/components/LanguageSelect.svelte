<script lang="ts">
	import { page } from '$app/stores';
	import * as Select from '$lib/components/ui/select';
	import { getURLForLanguage, languages } from '$lib/languages';
	import { Languages } from 'lucide-svelte';
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
</script>

<Select.Root bind:selected>
	<Select.Trigger class="w-[180px] {$$props.class ?? ''}">
		<Languages size="16" />
		<Select.Value class="ml-2 mr-auto" />
	</Select.Trigger>
	<Select.Content>
		{#each Object.entries(languages) as [lang, label]}
			<a href={getURLForLanguage($page.route.id, lang)}>
				<Select.Item value={lang}>{label}</Select.Item>
			</a>
		{/each}
	</Select.Content>
</Select.Root>

<!-- hidden links for svelte crawling -->
<div class="hidden">
	{#each Object.entries(languages) as [lang, label]}
		<a href={getURLForLanguage($page.route.id, lang)}>
			{label}
		</a>
	{/each}
</div>
