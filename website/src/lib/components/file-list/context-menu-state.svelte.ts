import type { GPXTreeElement, AnyGPXTreeElement, Waypoint } from 'gpx';
import type { ListItem } from './file-list';

/**
 * Shared state for the file list context menu.
 * Instead of having 100+ ContextMenu.Root components, we use a single one
 * and dynamically set the target item when right-clicking.
 */
class FileListContextMenuState {
    // The item that was right-clicked
    item: ListItem | null = $state(null);
    // The node data for that item
    node: GPXTreeElement<AnyGPXTreeElement> | Waypoint[] | Waypoint | null = $state(null);
    // Position for the context menu
    position: { x: number; y: number } = $state({ x: 0, y: 0 });
    // Whether the menu is open
    open: boolean = $state(false);

    trigger(
        item: ListItem,
        node: GPXTreeElement<AnyGPXTreeElement> | Waypoint[] | Waypoint,
        event: MouseEvent
    ) {
        this.item = item;
        this.node = node;
        this.position = { x: event.clientX, y: event.clientY };
        this.open = true;
    }

    close() {
        this.open = false;
    }
}

export const fileListContextMenu = new FileListContextMenuState();
