<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { settings } from '$lib/db';

	const { showWelcomeMessage } = settings;
</script>

<AlertDialog.Root
	open={$showWelcomeMessage === true}
	closeOnEscape={false}
	closeOnOutsideClick={false}
	onOpenChange={() => ($showWelcomeMessage = false)}
>
	<AlertDialog.Trigger class="hidden"></AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				Welcome to the new version of <b>gpx.studio</b>!
			</AlertDialog.Title>
			<AlertDialog.Description class="space-y-1">
				<p>The website is still under development and may contain bugs.</p>
				<p>Please report any issues you find by email or on GitHub.</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Action>Let's go!</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
