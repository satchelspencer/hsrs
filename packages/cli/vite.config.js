import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'cli.ts',
      formats: ['cjs'],
      fileName: () => 'cli.js',
    },
    outDir: '../dist/',
    emptyOutDir: true,
    target: 'node18',
    rollupOptions: {
      external: ['commander', 'fs', 'node-llama-cpp', 'path', 'node-fetch'],
    },
  },
})
