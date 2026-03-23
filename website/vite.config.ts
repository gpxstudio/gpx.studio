import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    server: {
        host: '0.0.0.0',
        proxy: {
            '/api/brouter': {
                target: 'https://brouter.gpx.studio',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/brouter/, ''),
            },
        },
    },
    ssr: {
        noExternal: ['gpx'],
    },
    plugins: [
        nodePolyfills({
            globals: {
                Buffer: true,
            },
        }),
        enhancedImages(),
        tailwindcss(),
        sveltekit(),
    ],
});
