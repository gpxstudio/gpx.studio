<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Popover from '$lib/components/ui/popover';
    import { Save } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { engine, type FileState } from '$lib/engine';
    import type { FileTreeNode } from '$lib/selection-helpers';

    let {
        fileState,
        node,
        open = $bindable(),
    }: {
        fileState: FileState;
        node: FileTreeNode;
        open: boolean;
    } = $props();

    let track = $derived(
        node.type === 'track'
            ? fileState.structure.tracks.find((track) => track.id === node.trackId)
            : undefined
    );
    let name: string = $derived(
        node.type === 'file' ? fileState.structure.name : (track?.name ?? '')
    );
    let description: string = $derived(
        node.type === 'file' ? (fileState.structure.desc ?? '') : (track?.desc ?? '')
    );

    $effect(() => {
        if (!open) {
            editMetadata.current = false;
        }
    });
</script>

<Popover.Root bind:open>
    <Popover.Trigger class="-mx-1" />
    <Popover.Content side="top" sideOffset={22} alignOffset={30} class="flex flex-col gap-3">
        <Label for="name">{i18n._('menu.metadata.name')}</Label>
        <Input bind:value={name} id="name" class="font-semibold h-8" />
        <Label for="description">{i18n._('menu.metadata.description')}</Label>
        <Textarea bind:value={description} id="description" />
        <Button
            variant="outline"
            onclick={() => {
                // the metadata of the selected elements are changed
                engine.metadata(name, description);
                open = false;
            }}
        >
            <Save size="16" />
            {i18n._('menu.metadata.save')}
        </Button>
    </Popover.Content>
</Popover.Root>
