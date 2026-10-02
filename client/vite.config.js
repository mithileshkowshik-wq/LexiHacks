import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The client calls relative "/api/..." paths (see src/lib/api.js);
    // in dev, forward those to the Express server so no CORS is involved.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
