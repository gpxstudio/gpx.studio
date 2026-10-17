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
        // the text on either side is not selected while dragging, and the cursor stays the one of
        // the resizer when the pointer leaves it
        event.preventDefault();
        const { style } = document.body;
        const previous = {
            userSelect: style.userSelect,
            webkitUserSelect: style.webkitUserSelect,
            cursor: style.cursor,
        };
        style.userSelect = 'none';
        style.webkitUserSelect = 'none';
        style.cursor = orientation === 'col' ? 'col-resize' : 'row-resize';

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
            window.removeEventListener('pointercancel', handleMouseUp);
            Object.assign(style, previous);
        };

        window.addEventListener('pointermove', handleMouseMove);
        window.addEventListener('pointerup', handleMouseUp);
        window.addEventListener('pointercancel', handleMouseUp);
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{orientation === 'col'
        ? 'w-1 h-full cursor-col-resize border-l'
        : 'w-full h-1 cursor-row-resize border-t'} {orientation}"
    onpointerdown={handleMouseDown}
></div>
