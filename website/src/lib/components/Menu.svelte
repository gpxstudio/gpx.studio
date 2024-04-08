<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Button } from '$lib/components/ui/button';
	import Logo from './Logo.svelte';

	let distanceUnits = 'metric';
	let velocityUnits = 'speed';
	let showDistanceMarkers = false;
	let showDirectionMarkers = false;
</script>

<div class="h-fit flex flex-row items-center mx-1">
	<Logo class="h-5 mt-1 mx-2" />
	<Menubar.Root class="border-none">
		<Menubar.Menu>
			<Menubar.Trigger>File</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item>
					New GPX file <Menubar.Shortcut>⌘N</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Load GPX file(s)... <Menubar.Shortcut>⌘O</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>
					Export... <Menubar.Shortcut>⌘S</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Export all... <Menubar.Shortcut>⇧⌘S</Menubar.Shortcut>
				</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger>Edit</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item>
					Undo <Menubar.Shortcut>⌘Z</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>
					Redo <Menubar.Shortcut>⇧⌘Z</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Separator />
				<Menubar.Item>Delete <Menubar.Shortcut>⌘D</Menubar.Shortcut></Menubar.Item>
				<Menubar.Item>Delete all<Menubar.Shortcut>⇧⌘D</Menubar.Shortcut></Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger>Help</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Item>
					Quick help <Menubar.Shortcut>⌘H</Menubar.Shortcut>
				</Menubar.Item>
				<Menubar.Item>User guide</Menubar.Item>
			</Menubar.Content>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger>Settings</Menubar.Trigger>
			<Menubar.Content
				><Menubar.Sub>
					<Menubar.SubTrigger inset>Distance units</Menubar.SubTrigger>
					<Menubar.SubContent>
						<Menubar.RadioGroup bind:value={distanceUnits}>
							<Menubar.RadioItem value="metric">Metric</Menubar.RadioItem>
							<Menubar.RadioItem value="imperial">Imperial</Menubar.RadioItem>
						</Menubar.RadioGroup>
					</Menubar.SubContent>
				</Menubar.Sub>
				<Menubar.Sub>
					<Menubar.SubTrigger inset>Velocity units</Menubar.SubTrigger>
					<Menubar.SubContent>
						<Menubar.RadioGroup bind:value={velocityUnits}>
							<Menubar.RadioItem value="speed">Speed</Menubar.RadioItem>
							<Menubar.RadioItem value="pace">Pace</Menubar.RadioItem>
						</Menubar.RadioGroup>
					</Menubar.SubContent>
				</Menubar.Sub>
				<Menubar.Separator />
				<Menubar.CheckboxItem bind:checked={showDistanceMarkers}>
					Show distance markers
				</Menubar.CheckboxItem>
				<Menubar.CheckboxItem bind:checked={showDirectionMarkers}>
					Show direction markers
				</Menubar.CheckboxItem>
			</Menubar.Content>
		</Menubar.Menu>
	</Menubar.Root>
	<div class="py-1 h-10">
		<Button
			variant="ghost"
			href="/about"
			target="_blank"
			class="cursor-default py-1.5 px-3 h-fit rounded-sm">About</Button
		>
	</div>
</div>
