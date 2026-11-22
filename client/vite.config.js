import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Pre-bundle the map libraries so the dev server never serves a stale dependency cache
  optimizeDeps: { include: ['leaflet', 'react-leaflet', 'react-dom/server'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
