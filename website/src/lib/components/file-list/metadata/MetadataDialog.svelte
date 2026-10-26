<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Popover from '$lib/components/ui/popover';
    import { Save } from '@lucide/svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { engine, type FileState } from '$lib/engine';
    import { pathInfo, type FileTreeNode } from '$lib/engine/selection-helpers';
    import { showEngineError } from '$lib/actions/file-actions';

    let {
        fileState,
        node,
        open = $bindable(),
    }: {
        fileState: FileState;
        node: FileTreeNode;
        open: boolean;
    } = $props();

    // the route or the track
    let path = $derived(pathInfo(fileState.structure, node));
    let name: string = $derived(
        node.type === 'file' ? fileState.structure.name : (path?.name ?? '')
    );
    let description: string = $derived(
        node.type === 'file' ? (fileState.structure.desc ?? '') : (path?.desc ?? '')
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
                // closes the dialog now: `open` follows `editMetadata`, and the change of the file
                // would open the dialog again before the effect below has reset it
                editMetadata.current = false;
                open = false;
                // the metadata of the selected elements are changed. In the desktop app, a file on
                // the disk is renamed with it, which is refused if the name is the one of another
                engine.metadata(name, description).then((changed) => {
                    if (!changed) {
                        showEngineError();
                    }
                });
            }}
        >
            <Save size="16" />
            {i18n._('menu.metadata.save')}
        </Button>
    </Popover.Content>
</Popover.Root>
