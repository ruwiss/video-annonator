import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: 'src/renderer',
  publicDir: false,
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'fabric': ['fabric'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'zustand': ['zustand'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['fabric', 'zustand', 'react-router-dom'],
  },
});
