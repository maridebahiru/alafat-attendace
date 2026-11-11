import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  optimizeDeps: {
    exclude: ['canvg', 'html2canvas', 'jspdf']
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      external: (id) => id.startsWith('core-js/modules/'),
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          pdf: ['jspdf', 'jspdf-autotable', 'html2canvas'],
          icons: ['lucide-react'],
          firebase: ['firebase/app', 'firebase/firestore']
        }
      }
    },
  },
});
