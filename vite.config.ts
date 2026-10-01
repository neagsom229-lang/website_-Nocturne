import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (normalizedId.includes('/node_modules/react-player/')) {
            const playerModule = normalizedId.match(/react-player\/(youtube|soundcloud|file)(?:\.|\/)/)?.[1];
            return playerModule ? `player-${playerModule}` : 'player-shared';
          }
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalizedId)) {
            return 'vendor-react';
          }
          if (/\/node_modules\/(react-router|react-router-dom|@remix-run\/router)\//.test(normalizedId)) {
            return 'vendor-router';
          }
        },
      },
    },
  },
});
