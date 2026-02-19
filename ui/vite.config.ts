import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/config': {
        target: 'http://config-service:8000',
        changeOrigin: true,
      },
      '/api/modules': {
        target: 'http://gateway:80',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://websocket-bridge:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          grid: ['react-grid-layout'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
