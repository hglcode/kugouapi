import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node22',
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    // 保持与 tsup 相同的单文件产物形态与扩展名（dist/index.js + dist/index.d.ts）
    unbundle: false,
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
