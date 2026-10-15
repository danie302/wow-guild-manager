import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Listen on every interface so the dev server is reachable from outside its container.
    host: true,
    port: 5173,
    strictPort: true,
  },
});
