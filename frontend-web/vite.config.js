import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://mcs-backend:5000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://mcs-backend:5000',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
