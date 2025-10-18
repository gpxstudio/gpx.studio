<script lang="ts">
    import ToolbarItem from '$lib/components/toolbar/ToolbarItem.svelte';
    import ToolbarItemMenu from '$lib/components/toolbar/ToolbarItemMenu.svelte';
    import { Tool } from '$lib/components/toolbar/tools';
    import {
        Group,
        CalendarClock,
        Pencil,
        SquareDashedMousePointer,
        Ungroup,
        MapPin,
        Funnel,
        Scissors,
        MountainSnow,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';

    let props: {
        class?: string;
    } = $props();
</script>

<div class="flex flex-row w-full items-center pr-12">
    <div
        class="h-fit flex flex-col p-1 gap-1.5 bg-background rounded-r-md pointer-events-auto shadow-md {props.class ??
            ''}"
    >
        <ToolbarItem itemTool={Tool.ROUTING} label={i18n._('toolbar.routing.tooltip')}>
            <Pencil size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.WAYPOINT} label={i18n._('toolbar.waypoint.tooltip')}>
            <MapPin size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.SCISSORS} label={i18n._('toolbar.scissors.tooltip')}>
            <Scissors size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.TIME} label={i18n._('toolbar.time.tooltip')}>
            <CalendarClock size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.MERGE} label={i18n._('toolbar.merge.tooltip')}>
            <Group size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.EXTRACT} label={i18n._('toolbar.extract.tooltip')}>
            <Ungroup size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.ELEVATION} label={i18n._('toolbar.elevation.button')}>
            <MountainSnow size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.REDUCE} label={i18n._('toolbar.reduce.tooltip')}>
            <Funnel size="18" class="size-4.5" />
        </ToolbarItem>
        <ToolbarItem itemTool={Tool.CLEAN} label={i18n._('toolbar.clean.tooltip')}>
            <SquareDashedMousePointer size="18" class="size-4.5" />
        </ToolbarItem>
    </div>
    <ToolbarItemMenu class={props.class ?? ''} />
</div>
