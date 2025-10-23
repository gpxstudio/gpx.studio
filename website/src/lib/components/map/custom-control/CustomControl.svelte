<script lang="ts">
    import CustomControl from './custom-control';
    import { map } from '$lib/components/map/map';
    import { onMount, type Snippet } from 'svelte';

    let {
        position = 'top-right',
        class: className = '',
        children,
    }: {
        position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        class: string;
        children: Snippet;
    } = $props();

    let container: HTMLDivElement;
    let control: CustomControl | null = null;

    onMount(() => {
        map.onLoad((map: mapboxgl.Map) => {
            if (position.includes('right')) container.classList.add('float-right');
            else container.classList.add('float-left');
            container.classList.remove('hidden');
            if (control === null) {
                control = new CustomControl(container);
            }
            map.addControl(control, position);
        });
    });
</script>

<div
    bind:this={container}
    class="{className ||
        ''} clear-both translate-0 m-[10px] mb-0 last:mb-[10px] pointer-events-auto bg-background rounded shadow-md hidden"
>
    {@render children()}
</div>
