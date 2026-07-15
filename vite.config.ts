import { defineConfig } from 'vite'

const API = `http://localhost:${process.env.API_PORT || 5174}`

export default defineConfig({
  server: {
    proxy: {
      '/api': API,
      // Keep /uploads local from public/ in Vite; API writes into public/uploads
    },
  },
  preview: {
    proxy: {
      '/api': API,
    },
  },
})
