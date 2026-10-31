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

    interface Window {
        /** The map, for extensions (set once it has loaded). */
        _map?: import('maplibre-gl').Map;
    }
}

export {};
