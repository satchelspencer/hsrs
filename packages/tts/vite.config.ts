import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 8178 },
  plugins: [react()],
  base: './',
  build: { assetsDir: '', outDir: '../dist/', emptyOutDir: true },
})
