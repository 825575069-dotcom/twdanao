import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5181,
    strictPort: true,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist-h5',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'h5.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
