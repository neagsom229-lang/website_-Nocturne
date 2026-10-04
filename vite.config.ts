import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const PUBLIC_SUPABASE_URL = 'https://shgaguqairkhtdhazdnp.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoZ2FndXFhaXJraHRkaGF6ZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MjAwODgsImV4cCI6MjEwNjM5NjA4OH0.g2b7sc8RVWcCevpwR3fXFSwg6otlNY8Y8Zah9XheX8g';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = env.PORT || process.env.PORT || '3000';
  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(PUBLIC_SUPABASE_URL),
      __SUPABASE_ANON_KEY__: JSON.stringify(PUBLIC_SUPABASE_ANON_KEY),
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${port}`,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, _res) => {
              // Suppress connection ECONNREFUSED spam during cold start before backend is listening
            });
          },
        },
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
