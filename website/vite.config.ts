import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
    plugins: [
        nodePolyfills({
            globals: {
                Buffer: true,
            },
        }),
        enhancedImages(),
        sveltekit(),
        SvelteKitPWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true,
            },
            workbox: {
                maximumFileSizeToCacheInBytes: 3000000,
            },
            manifest: {
                id: '/',
                name: 'GPX Studio',
                short_name: 'GPX Studio',
                description: 'View, edit, and create GPX files online.',
                display: 'standalone',
                icons: [
                    {
                        src: 'pwa/144.png',
                        sizes: '144x144',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa/192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa/512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                ],
            },
        }),
    ],
});
