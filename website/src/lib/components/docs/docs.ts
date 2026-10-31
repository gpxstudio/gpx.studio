import {
    File,
    FilePen,
    View,
    Settings,
    Pencil,
    MapPin,
    Scissors,
    CalendarClock,
    Group,
    Ungroup,
    Funnel,
    SquareDashedMousePointer,
    MountainSnow,
    type IconProps,
} from '@lucide/svelte';
import type { Component } from 'svelte';

export const guideIcons: Record<string, string | Component<IconProps>> = {
    'getting-started': '🚀',
    menu: '📂 ⚙️',
    file: File,
    edit: FilePen,
    view: View,
    settings: Settings,
    'files-and-stats': '🗂 📈',
    toolbar: '🧰',
    routing: Pencil,
    poi: MapPin,
    scissors: Scissors,
    time: CalendarClock,
    merge: Group,
    extract: Ungroup,
    elevation: MountainSnow,
    minify: Funnel,
    clean: SquareDashedMousePointer,
    'map-controls': '🗺',
    gpx: '💾',
    integration: '{ 👩‍💻 }',
    faq: '🔮',
};

export { guides, getNextGuide, getPreviousGuide } from './guides';
