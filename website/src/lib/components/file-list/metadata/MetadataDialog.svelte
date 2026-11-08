<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox';
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

    const { workspace } = engine;

    // the name of the file on the disk, without its extension (the desktop app), which is not the
    // name of the file: it can be renamed with it, which is not undone
    let fileName = $derived.by(() => {
        if (node.type !== 'file') return undefined;
        const path = $workspace?.files[node.fileId]?.path;
        return path
            ?.split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]*$/, '');
    });
    // asked only when the name is changed, and proposed then
    let renamed = $derived(node.type === 'file' && name !== fileState.structure.name);
    let renameFile = $state(true);

    async function save() {
        // closes the dialog now: `open` follows `editMetadata`, and the change of the file would
        // open the dialog again before the effect below has reset it
        editMetadata.current = false;
        open = false;
        // the file on the disk first: nothing is changed if it cannot be renamed (the name of
        // another file, for instance)
        if (
            renamed &&
            renameFile &&
            fileName !== undefined &&
            fileName !== name &&
            node.type === 'file'
        ) {
            if (!(await engine.renameFile(node.fileId, name))) {
                showEngineError();
                return;
            }
        }
        engine.metadata(name, description);
    }

    $effect(() => {
        if (!open) {
            editMetadata.current = false;
            renameFile = true;
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
        {#if fileName !== undefined && renamed}
            <div class="flex flex-row items-center gap-2">
                <Checkbox id="rename-file" bind:checked={renameFile} class="scale-90" />
                <Label for="rename-file">{i18n._('menu.metadata.rename_file')}</Label>
            </div>
        {/if}
        <Button variant="outline" onclick={save}>
            <Save size="16" />
            {i18n._('menu.metadata.save')}
        </Button>
    </Popover.Content>
</Popover.Root>
