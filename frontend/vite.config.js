import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Subimos el límite (con manualChunks ya estamos partidos)
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Code-splitting por vendor pesado: mejora cache de cliente y first paint.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          leaflet: ['leaflet', 'react-leaflet'],
          icons: ['lucide-react'],
          toast: ['react-hot-toast'],
        },
      },
    },
  },
})
