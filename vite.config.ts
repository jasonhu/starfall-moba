import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 产出与线上一致：一个 HTML 内联所有 JS/CSS
// 默认 build 不压缩（保留可读性，便于调试）；build:release 通过 RELEASE_MINIFY=1 开启压缩。
export default defineConfig(() => ({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4096,
    minify: process.env.RELEASE_MINIFY === '1' ? 'esbuild' : false,
    cssCodeSplit: false,
    // 发布版单独输出，避免覆盖调试版 dist/index.html
    outDir: process.env.RELEASE_MINIFY === '1' ? 'dist-release' : 'dist',
  },
}))
