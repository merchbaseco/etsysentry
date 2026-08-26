import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const envDir = resolve(rootDir, '../..');

/**
 * `ETSYSENTRY_DEV_HOST` is the repository's contract for the dev server's bind
 * address, and it defaults to loopback. An environment that reaches the server
 * through a port forwarder — a cloud dev session, a container, a remote VM —
 * sets `ETSYSENTRY_DEV_HOST=0.0.0.0` for the dev command, because such
 * forwarders find a session's ports by watching for listening sockets and a
 * 127.0.0.1-only bind is invisible to them. Everything else keeps the dev
 * server — and the synthetic seed data behind it — off the network. `preview`
 * inherits this host. An externally exported value survives `varlock run`:
 * varlock resolves the declared item from `process.env` and validates it before
 * handing it to the child.
 */
const devServerHost = process.env.ETSYSENTRY_DEV_HOST ?? '127.0.0.1';

export default defineConfig({
    envDir,
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
        host: devServerHost,
        port: 3100,
        strictPort: false,
        fs: {
            allow: [envDir, rootDir],
        },
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            '/auth': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            '/healthz': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:8080',
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
