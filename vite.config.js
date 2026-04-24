import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Warn when a single chunk exceeds 600 kB (default 500)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // manualChunks must be a function in Vite 8 (Rolldown)
        manualChunks(id) {
          if (id.includes('node_modules/exceljs'))          return 'excel'
          if (id.includes('node_modules/recharts'))         return 'charts'
          if (id.includes('node_modules/@supabase'))        return 'supabase'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) return 'vendor'
        },
      },
    },
  },
})
