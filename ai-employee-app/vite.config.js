import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
// 使用相对路径 base，便于 Electron 通过 file:// 加载打包产物
export default defineConfig({
    plugins: [
        react(),
        // Electron 通过 file:// 加载时，script 的 crossorigin 属性会导致模块加载失败，需移除
        {
            name: 'remove-crossorigin-for-electron',
            closeBundle: function () {
                var indexPath = resolve(__dirname, 'dist', 'index.html');
                if (fs.existsSync(indexPath)) {
                    var html = fs.readFileSync(indexPath, 'utf-8');
                    html = html.replace(/\scrossorigin/g, '');
                    fs.writeFileSync(indexPath, html);
                }
            }
        }
    ],
    base: './',
    server: {
        port: 5180,
        strictPort: true,
        host: '127.0.0.1'
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        modulePreload: false
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    }
});
