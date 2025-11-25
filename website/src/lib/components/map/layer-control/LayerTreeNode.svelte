<script lang="ts">
    import Self from '$lib/components/map/layer-control/LayerTreeNode.svelte';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import CollapsibleTreeNode from '$lib/components/collapsible-tree/CollapsibleTreeNode.svelte';
    import { type LayerTreeType } from '$lib/assets/layers';
    import { anySelectedLayer } from './utils';
    import { i18n } from '$lib/i18n.svelte';
    import { settings } from '$lib/logic/settings';
    import { extensionAPI } from '$lib/components/map/layer-control/extension-api';

    let {
        name,
        node,
        selected = '',
        onselect = () => {},
        multiple = false,
        checked = $bindable({}),
    }: {
        name: string;
        node: LayerTreeType;
        selected?: string;
        onselect?: (value: string) => void;
        multiple: boolean;
        checked: LayerTreeType;
    } = $props();

    const { customLayers } = settings;
    const { isLayerFromExtension, getLayerName } = extensionAPI;

    $effect.pre(() => {
        if (checked !== undefined) {
            Object.keys(node).forEach((id) => {
                if (!checked.hasOwnProperty(id)) {
                    if (typeof node[id] == 'boolean') {
                        checked[id] = false;
                    } else {
                        checked[id] = {};
                    }
                }
            });
        }
    });
</script>

<div class="flex flex-col gap-[3px]">
    {#each Object.keys(node) as id}
        {#if typeof node[id] == 'boolean'}
            {#if node[id]}
                <div class="flex flex-row items-center gap-2 first:mt-0.5 h-4">
                    {#if multiple}
                        <Checkbox
                            id="{name}-{id}"
                            {name}
                            value={id}
                            bind:checked={checked[id]}
                            class="scale-90"
                            aria-label={i18n._(`layers.label.${id}`)}
                        />
                    {:else}
                        <input
                            id="{name}-{id}"
                            type="radio"
                            {name}
                            value={id}
                            checked={selected === id}
                            oninput={(e) => {
                                if ((e.target as HTMLInputElement)?.checked) {
                                    onselect(id);
                                }
                            }}
                        />
                    {/if}
                    <Label for="{name}-{id}" class="flex flex-row items-center gap-1">
                        {#if $customLayers.hasOwnProperty(id)}
                            {$customLayers[id].name}
                        {:else if $isLayerFromExtension(id)}
                            {$getLayerName(id)}
                        {:else}
                            {i18n._(`layers.label.${id}`)}
                        {/if}
                    </Label>
                </div>
            {/if}
        {:else if anySelectedLayer(node[id])}
            <CollapsibleTreeNode {id}>
                {#snippet trigger()}
                    <span>{i18n._(`layers.label.${id}`, id)}</span>
                {/snippet}
                {#snippet content()}
                    <div class="ml-2">
                        <Self
                            node={node[id]}
                            {name}
                            {selected}
                            {onselect}
                            {multiple}
                            bind:checked={checked[id]}
                        />
                    </div>
                {/snippet}
            </CollapsibleTreeNode>
        {/if}
    {/each}
</div>

<style lang="postcss">
    @reference "../../../../app.css";

    div :global(input[type='radio']) {
        @apply appearance-none;
        @apply w-4 h-4;
        @apply border-[1.5px] border-primary;
        @apply rounded-full;
        @apply ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
        @apply cursor-pointer;
        @apply checked:bg-primary;
        @apply checked:bg-clip-content;
        @apply checked:p-0.5;
    }
</style>
