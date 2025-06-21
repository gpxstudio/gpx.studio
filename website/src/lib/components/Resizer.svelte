<script lang="ts">
    let {
        orientation = 'col',
        after = $bindable(),
        minAfter = 0,
        maxAfter = Number.MAX_SAFE_INTEGER,
    }: {
        orientation?: 'col' | 'row';
        after: number;
        minAfter?: number;
        maxAfter?: number;
    } = $props();

    function handleMouseDown(event: PointerEvent) {
        const startX = event.clientX;
        const startY = event.clientY;
        const startAfter = after;

        const handleMouseMove = (event: PointerEvent) => {
            const newAfter =
                startAfter +
                (orientation === 'col' ? startX - event.clientX : startY - event.clientY);
            if (newAfter >= minAfter && newAfter <= maxAfter) {
                after = newAfter;
            } else if (newAfter < minAfter && after !== minAfter) {
                after = minAfter;
            } else if (newAfter > maxAfter && after !== maxAfter) {
                after = maxAfter;
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('pointermove', handleMouseMove);
            window.removeEventListener('pointerup', handleMouseUp);
        };

        window.addEventListener('pointermove', handleMouseMove);
        window.addEventListener('pointerup', handleMouseUp);
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{orientation === 'col'
        ? 'w-1 h-full cursor-col-resize border-l'
        : 'w-full h-1 cursor-row-resize border-t'} {orientation}"
    onpointerdown={handleMouseDown}
></div>
