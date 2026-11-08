<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { canChangeStart, canRouteBackToStart } from './routing-controls';
    import { CirclePlay, House, Trash2 } from '@lucide/svelte';

    import { i18n } from '$lib/i18n.svelte';

    let {
        element = $bindable(),
    }: {
        element: HTMLElement | undefined;
    } = $props();
</script>

<div bind:this={element} class="hidden">
    <Card.Root class="border-none shadow-md text-base p-0 gap-0 rounded-lg">
        <Card.Content class="flex flex-col p-1">
            {#if $canChangeStart}
                <Button
                    class="w-full px-2 py-1 h-6 justify-start"
                    variant="ghost"
                    onclick={() => element?.dispatchEvent(new CustomEvent('change-start'))}
                >
                    <CirclePlay size="16" />
                    {i18n._('toolbar.routing.start_loop_here')}
                </Button>
            {/if}
            {#if $canRouteBackToStart}
                <Button
                    class="w-full px-2 py-1 h-6 justify-start"
                    variant="ghost"
                    onclick={() => element?.dispatchEvent(new CustomEvent('route-back-to-start'))}
                >
                    <House size="16" />
                    {i18n._('toolbar.routing.route_back_to_start.button')}
                </Button>
            {/if}
            <Button
                class="w-full px-2 py-1 h-6 justify-start"
                variant="ghost"
                onclick={() => element?.dispatchEvent(new CustomEvent('delete'))}
            >
                <Trash2 size="16" />
                {i18n._('menu.delete')}
                <Shortcut shift={true} click={true} />
            </Button>
        </Card.Content>
    </Card.Root>
</div>
