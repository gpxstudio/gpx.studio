<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Slider } from '$lib/components/ui/slider';
    import * as Popover from '$lib/components/ui/popover';
    import { Save } from '@lucide/svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { settings } from '$lib/logic/settings';
    import { engine, type FileState } from '$lib/engine';
    import { normalizeColor } from '$lib/file-colors';
    import { selectedFileIds, type FileTreeNode } from '$lib/selection-helpers';
    import { untrack } from 'svelte';

    let {
        fileState,
        node,
        open = $bindable(),
    }: {
        fileState: FileState;
        node: FileTreeNode;
        open: boolean;
    } = $props();

    const { defaultOpacity, defaultWidth } = settings;
    const { files, selection } = engine;

    let color: string = $state('');
    let opacity: number = $state(0);
    let width: number = $state(0);
    let colorChanged = $state(false);
    let opacityChanged = $state(false);
    let widthChanged = $state(false);

    // TODO the inputs used to come from the last selected item, they now come from this node
    function setStyleInputs() {
        opacity = $defaultOpacity;
        width = $defaultWidth;
        color = fileState.color;

        const { tracks } = fileState.structure;
        if (node.type === 'file') {
            opacity = tracks.find((track) => track.opacity !== undefined)?.opacity ?? opacity;
            width = tracks.find((track) => track.width !== undefined)?.width ?? width;
        } else if (node.type === 'track') {
            const track = tracks.find((track) => track.id === node.trackId);
            if (track) {
                color = track.color !== undefined ? normalizeColor(track.color) : color;
                opacity = track.opacity ?? opacity;
                width = track.width ?? width;
            }
        }

        colorChanged = false;
        opacityChanged = false;
        widthChanged = false;
    }

    $effect(() => {
        if ($selection && open) {
            untrack(() => setStyleInputs());
        }
    });

    $effect(() => {
        if (!open) {
            editStyle.current = false;
        }
    });

    function applyStyle() {
        // closes the dialog now: `open` follows `editStyle`, and the style changes the file, which
        // would open the dialog again before the effect below has reset it
        editStyle.current = false;
        open = false;

        engine.style({
            color: colorChanged ? color : undefined,
            opacity: opacityChanged ? opacity : undefined,
            width: widthChanged ? width : undefined,
        });

        if (node.type === 'file' && selectedFileIds($selection).length === $files.size) {
            if (opacityChanged) {
                $defaultOpacity = opacity;
            }
            if (widthChanged) {
                $defaultWidth = width;
            }
        }
    }
</script>

<Popover.Root bind:open>
    <Popover.Trigger class="-mx-1" />
    <Popover.Content side="top" sideOffset={22} alignOffset={30} class="flex flex-col gap-3">
        <Label class="flex flex-row gap-2 items-center justify-between">
            {i18n._('menu.style.color')}
            <Input
                bind:value={color}
                type="color"
                class="p-0 h-6 w-40"
                onchange={() => (colorChanged = true)}
            />
        </Label>
        <Label class="flex flex-row gap-2 items-center justify-between">
            {i18n._('menu.style.opacity')}
            <div class="w-40 p-2">
                <Slider
                    bind:value={opacity}
                    min={0.3}
                    max={1}
                    step={0.1}
                    onValueChange={() => (opacityChanged = true)}
                    type="single"
                />
            </div>
        </Label>
        <Label class="flex flex-row gap-2 items-center justify-between">
            {i18n._('menu.style.width')}
            <div class="w-40 p-2">
                <Slider
                    bind:value={width}
                    id="width"
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={() => (widthChanged = true)}
                    type="single"
                />
            </div>
        </Label>
        <Button
            variant="outline"
            disabled={!colorChanged && !opacityChanged && !widthChanged}
            onclick={applyStyle}
        >
            <Save size="16" />
            {i18n._('menu.metadata.save')}
        </Button>
    </Popover.Content>
</Popover.Root>
