<script lang="ts">
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import { Button } from '$lib/components/ui/button';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { unsavedPrompt } from './unsaved-prompt.svelte';

    let prompt = $derived(unsavedPrompt.current);

    /** Closes the dialog, and gives the answer to whoever asked. */
    function answer(choice: 'save' | 'discard' | 'reload' | 'cancel') {
        const current = unsavedPrompt.current;
        unsavedPrompt.current = undefined;
        if (current?.kind === 'unsaved' && choice !== 'reload') {
            current.resolve(choice);
        } else if (current?.kind === 'overwrite') {
            current.resolve(
                choice === 'save' ? 'overwrite' : choice === 'reload' ? 'reload' : 'cancel'
            );
        }
    }
</script>

<AlertDialog.Root
    open={prompt !== undefined}
    onOpenChange={(open) => {
        if (!open) {
            answer('cancel');
        }
    }}
>
    <AlertDialog.Content>
        {#if prompt}
            <AlertDialog.Header>
                <AlertDialog.Title>
                    {prompt.kind === 'unsaved'
                        ? i18n._('menu.unsaved_title')
                        : i18n._('menu.overwrite_title')}
                </AlertDialog.Title>
                <AlertDialog.Description>
                    {prompt.kind === 'unsaved'
                        ? i18n._('menu.unsaved_description')
                        : i18n._('menu.overwrite_description')}
                </AlertDialog.Description>
            </AlertDialog.Header>
            <ul class="list-disc pl-6 text-sm max-h-40 overflow-y-auto">
                {#each prompt.names as name}
                    <li>{name}</li>
                {/each}
            </ul>
            <AlertDialog.Footer>
                <Button variant="outline" onclick={() => answer('cancel')}>
                    {i18n._('menu.cancel')}
                </Button>
                {#if prompt.kind === 'unsaved'}
                    <Button variant="destructive" onclick={() => answer('discard')}>
                        {i18n._('menu.discard')}
                    </Button>
                {:else}
                    <Button variant="destructive" onclick={() => answer('reload')}>
                        {i18n._('menu.reload')}
                    </Button>
                {/if}
                <Button onclick={() => answer('save')}>
                    {prompt.kind === 'unsaved' ? i18n._('menu.save') : i18n._('menu.overwrite')}
                </Button>
            </AlertDialog.Footer>
        {/if}
    </AlertDialog.Content>
</AlertDialog.Root>
