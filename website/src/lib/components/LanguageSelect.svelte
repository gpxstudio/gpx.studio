<script lang="ts">
	import { goto } from '$app/navigation';
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

<Select.Root bind:selected onSelectedChange={(s) => goto(getURLForLanguage(s?.value))}>
	<Select.Trigger class="w-[180px] {$$props.class ?? ''}">
		<Languages size="16" />
		<Select.Value class="ml-2 mr-auto" />
	</Select.Trigger>
	<Select.Content>
		{#each Object.entries(languages) as [key, value]}
			<Select.Item value={key}>{value}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
