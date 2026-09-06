import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'chmod-bin',
      closeBundle() {
        const out = path.resolve(__dirname, 'dist/cli.cjs')
        if (fs.existsSync(out)) fs.chmodSync(out, 0o755)
      },
    },
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: false,
    target: 'node18',
    lib: {
      entry: 'index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'commander',
        'fs',
        'path',
        'json-stable-stringify',
        'lodash',
        'JSONStream',
        'chartjs-node-canvas',
        'chart.js',
      ],
      output: {
        banner: '#!/usr/bin/env node',
        exports: 'auto',
        interop: 'auto',
        inlineDynamicImports: true,
      },
    },
  },
})
