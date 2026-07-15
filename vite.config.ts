import { defineConfig } from 'vite'

const API = `http://localhost:${process.env.API_PORT || 5174}`

/** GitHub Project Pages URL path: https://levizigza.github.io/Levi-Zigza-Artist-Portfolio/ */
const PAGES_BASE = '/Levi-Zigza-Artist-Portfolio/'

export default defineConfig({
  // Required so JS/CSS/assets resolve under the repo subpath on GitHub Pages.
  // Local: Vite serves at http://localhost:5173/Levi-Zigza-Artist-Portfolio/
  base: PAGES_BASE,
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
