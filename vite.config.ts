import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { apiApp } from './server/app';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'biopulse-express-api',
      configureServer(server) {
        server.middlewares.use(apiApp);
      },
      configurePreviewServer(server) {
        server.middlewares.use(apiApp);
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
