import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'

const API = `http://localhost:${process.env.API_PORT || 5174}`

/** GitHub Project Pages URL path: https://levizigza.github.io/Levi-Zigza-Artist-Portfolio/ */
const PAGES_BASE = '/Levi-Zigza-Artist-Portfolio/'
const ADMIN_INDEX = `${PAGES_BASE}admin/index.html`

/**
 * Vite SPA mode falls back unknown paths (including `/admin/`) to the portfolio
 * root `index.html`, which hides `public/admin/index.html`. Rewrite/redirect so
 * the admin shell actually loads in `vite` / `vite preview`.
 */
function adminHtmlPlugin(): Plugin {
  const bareAdmin = new Set(['/admin', '/admin/'])
  const baseAdminNoSlash = `${PAGES_BASE}admin`.replace(/\/$/, '') // /…/admin
  const baseAdminSlash = `${PAGES_BASE}admin/`

  const mount = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
        next()
        return
      }
      const [pathname, search = ''] = req.url.split('?')
      const q = search ? `?${search}` : ''

      // Bare /admin → canonical base-path admin (avoids 404 under Vite `base`)
      if (bareAdmin.has(pathname)) {
        res.statusCode = 302
        res.setHeader('Location', `${baseAdminSlash}${q}`)
        res.end()
        return
      }

      // /base/admin → trailing slash (relative ./admin.css + ./admin.js)
      if (pathname === baseAdminNoSlash) {
        res.statusCode = 301
        res.setHeader('Location', `${baseAdminSlash}${q}`)
        res.end()
        return
      }

      // /base/admin/ → real admin HTML (not SPA shell)
      if (pathname === baseAdminSlash) {
        req.url = `${ADMIN_INDEX}${q}`
      }
      next()
    })
  }

  return {
    name: 'admin-html-routing',
    configureServer(server) {
      mount(server.middlewares)
    },
    configurePreviewServer(server) {
      mount(server.middlewares)
    },
  }
}

export default defineConfig({
  // Required so JS/CSS/assets resolve under the repo subpath on GitHub Pages.
  // Local: Vite serves at http://localhost:5173/Levi-Zigza-Artist-Portfolio/
  base: PAGES_BASE,
  plugins: [adminHtmlPlugin()],
  server: {
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
      },
    },
  },
})
