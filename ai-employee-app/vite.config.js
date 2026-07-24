import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
// 使用相对路径 base，便于 Electron 通过 file:// 加载打包产物
export default defineConfig({
    plugins: [react()],
    base: './',
    server: {
        port: 5180,
        strictPort: true,
        host: '127.0.0.1'
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    }
});
