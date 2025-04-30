import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 8177 },
  plugins: [react()],
  base: './',
  build: { assetsDir: '', outDir: '../dist/', emptyOutDir: true },
  worker: {
    format: 'es',
  },
})
