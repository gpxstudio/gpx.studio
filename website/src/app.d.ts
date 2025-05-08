import type * as mapboxgl from 'mapbox-gl'; // Import mapboxgl for the Map type
import type { Waypoint } from 'gpx'; // Import Waypoint from gpx package
import type { ListItem } from '$lib/components/file-list/FileList'; // Added ListItem import

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    // Augment the global Window interface
    interface Window {
        _map?: mapboxgl.Map; // Add _map property
    }
}

// Augment the mapbox-gl module
declare module 'mapbox-gl' {
    interface Marker {
        // Add the dynamically attached property
        _waypoint?: Waypoint;
    }
}

// Declare mapbox-gl-geocoder module
declare module '@mapbox/mapbox-gl-geocoder';

// Augment the Chart.js module
declare module 'chart.js' {
    // TType is keyof ChartTypeRegistry, typically 'line', 'bar', etc.
    // TData is the data array type.
    interface ChartDataset<
        TType extends import('chart.js').ChartType = import('chart.js').ChartType,
        TData = import('chart.js').DefaultDataPoint<TType>,
    > {
        segment?:
            | {
                  backgroundColor?: (
                      context: import('chart.js').ScriptableContext<TType>
                  ) => import('chart.js').Color;
              }
            | Record<string, never>; // Use Record<string, never> for an empty object and removed index signature
    }
}

// Augment the sortablejs module
declare module 'sortablejs' {
    interface Sortable {
        _item?: ListItem; // Add optional internal property
        _waypointRoot?: boolean; // Add optional internal property
    }
}

export {};
