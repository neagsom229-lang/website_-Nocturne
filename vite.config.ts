import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = env.PORT || process.env.PORT || '3000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': `http://localhost:${port}`,
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
  };
});
