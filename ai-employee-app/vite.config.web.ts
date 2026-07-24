import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5182,
    strictPort: true,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'web.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
