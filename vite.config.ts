import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const isCapacitor = process.env.BUILD_TARGET === 'capacitor'
// Vercel (fissastock.fr) et l'app native servent le site à la racine ;
// GitHub Pages (ancienne URL) le sert sous /fissa-stock/.
const isVercel = !!process.env.VERCEL

export default defineConfig({
  base: isCapacitor || isVercel ? '/' : '/fissa-stock/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
