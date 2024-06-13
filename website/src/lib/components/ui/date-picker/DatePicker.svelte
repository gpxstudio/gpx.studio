<script lang="ts">
	import CalendarIcon from 'lucide-svelte/icons/calendar';
	import { DateFormatter, type DateValue, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	export let value: DateValue | undefined = undefined;
	export let placeholder: string = 'Pick a date';
	export let locale = 'en';
	export let disabled: boolean = false;
	export let onValueChange: any;

	const df = new DateFormatter(locale, {
		dateStyle: 'long'
	});
</script>

<Popover.Root>
	<Popover.Trigger asChild let:builder>
		<Button
			variant="outline"
			class={cn(
				'w-[280px] justify-start text-left font-normal',
				!value && 'text-muted-foreground',
				$$props.class
			)}
			{disabled}
			builders={[builder]}
		>
			<CalendarIcon class="mr-2 h-4 w-4" />
			{value ? df.format(value.toDate(getLocalTimeZone())) : placeholder}
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0">
		<Calendar bind:value initialFocus {locale} {onValueChange} />
	</Popover.Content>
</Popover.Root>
