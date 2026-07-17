import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import {
  clearSessionCookie,
  createSessionToken,
  isAuthenticated,
  passwordsMatch,
  setSessionCookie,
} from './auth.js'
import {
  ROOT,
  UPLOADS_DIR,
  addManifestItem,
  ensureUploadsLayout,
  readManifest,
  removeManifestItem,
  resolveUploadPath,
} from './manifest.js'
import {
  deleteFromSupabase,
  isSupabaseConfigured,
  uploadToSupabase,
} from './supabaseStorage.js'

// Load .env from repo root (not process.cwd) so Windows / concurrently starts still work.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'),
})

const PORT = Number(process.env.PORT || 5174)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

/** @type {Record<string, { folder: string, maxBytes: number, mimes: Set<string>, exts: Set<string> }>} */
const TYPE_RULES = {
  video: {
    folder: 'video',
    maxBytes: 120 * 1024 * 1024,
    mimes: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
    exts: new Set(['.mp4', '.webm', '.mov']),
  },
  photo: {
    folder: 'photo',
    maxBytes: 20 * 1024 * 1024,
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    exts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']),
  },
  audio: {
    folder: 'audio',
    maxBytes: 40 * 1024 * 1024,
    mimes: new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/aac']),
    exts: new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']),
  },
  script: {
    folder: 'script',
    maxBytes: 512 * 1024,
    mimes: new Set(['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream']),
    exts: new Set(['.txt', '.md', '.markdown']),
  },
}

const MEDIA_TYPES = new Set(Object.keys(TYPE_RULES))

function sanitizeTitle(raw) {
  const t = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 120)
  return t || 'Untitled'
}

function sanitizeBaseName(name) {
  const base = path.basename(String(name || 'file'))
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80)
  return cleaned || 'file'
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024, files: 1 },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
})

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded. Try again later.' },
})

async function main() {
  await ensureUploadsLayout()

  const app = express()
  app.set('trust proxy', 1)
  app.use(cookieParser())
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/session', (req, res) => {
    res.json({ authenticated: isAuthenticated(req) })
  })

  app.post('/api/login', loginLimiter, (req, res) => {
    if (!ADMIN_PASSWORD) {
      res.status(503).json({
        error: 'ADMIN_PASSWORD is not set. Add it to .env before logging in.',
      })
      return
    }
    const password = String(req.body?.password ?? '')
    if (!passwordsMatch(password, ADMIN_PASSWORD)) {
      res.status(401).json({ error: 'Invalid password' })
      return
    }
    setSessionCookie(res, createSessionToken())
    res.json({ ok: true })
  })

  app.post('/api/logout', (req, res) => {
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  app.get('/api/manifest', async (_req, res) => {
    const manifest = await readManifest()
    res.setHeader('Cache-Control', 'no-store')
    res.json(manifest)
  })

  const ttsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TTS rate limit exceeded.' },
  })

  /**
   * Neural TTS for opening VO (dev / Node host).
   * Prefer shipping baked public/audio/vo/line-XX.mp3 for GitHub Pages.
   * Body: { text, index?, voice? } → caches MP3 under public/audio/vo/.
   */
  app.post('/api/tts', ttsLimiter, async (req, res) => {
    try {
      const text = String(req.body?.text ?? '').trim().slice(0, 500)
      if (!text) {
        res.status(400).json({ error: 'Missing text' })
        return
      }
      const { synthesizeToFile, lineFileName, cacheNameForText } = await import('./tts.js')
      const voDir = path.join(ROOT, 'public', 'audio', 'vo')
      await fs.mkdir(voDir, { recursive: true })

      const idx = Number.isFinite(Number(req.body?.index)) ? Number(req.body.index) : -1
      const file =
        idx >= 0 && idx < 64 ? lineFileName(idx) : cacheNameForText(text)
      const abs = path.join(voDir, file)

      try {
        const st = await fs.stat(abs)
        if (st.size > 500) {
          res.json({ url: `/audio/vo/${file}`, cached: true })
          return
        }
      } catch {
        /* synthesize */
      }

      const voice = req.body?.voice ? String(req.body.voice) : undefined
      await synthesizeToFile(text, { outPath: abs, voice })
      res.json({ url: `/audio/vo/${file}`, cached: false })
    } catch (err) {
      console.error('[tts]', err?.message || err)
      res.status(503).json({
        error: 'TTS unavailable',
        detail: String(err?.message || err).slice(0, 200),
      })
    }
  })

  app.post(
    '/api/upload',
    requireAuth,
    uploadLimiter,
    upload.single('file'),
    async (req, res) => {
      try {
        const type = String(req.body?.type ?? '')
        if (!MEDIA_TYPES.has(type)) {
          res.status(400).json({ error: 'Invalid type. Use video, photo, audio, or script.' })
          return
        }
        const rules = TYPE_RULES[type]
        const file = req.file
        if (!file) {
          res.status(400).json({ error: 'Missing file' })
          return
        }
        if (file.size > rules.maxBytes) {
          res.status(400).json({
            error: `File too large. Max ${Math.round(rules.maxBytes / (1024 * 1024))}MB for ${type}.`,
          })
          return
        }

        const ext = path.extname(file.originalname || '').toLowerCase()
        if (!rules.exts.has(ext)) {
          res.status(400).json({
            error: `Invalid extension for ${type}. Allowed: ${[...rules.exts].join(', ')}`,
          })
          return
        }

        const mime = (file.mimetype || '').toLowerCase()
        if (mime && !rules.mimes.has(mime) && type !== 'script') {
          res.status(400).json({ error: `Unsupported MIME type: ${mime}` })
          return
        }

        const title = sanitizeTitle(req.body?.title || path.parse(file.originalname).name)
        const id = crypto.randomUUID()
        const safe = sanitizeBaseName(path.parse(file.originalname).name)
        const filename = `${id.slice(0, 8)}-${safe}${ext}`

        let publicPath = `/uploads/${rules.folder}/${filename}`
        const cloudUrl = await uploadToSupabase({
          folder: rules.folder,
          filename,
          buffer: file.buffer,
          contentType: file.mimetype || undefined,
        })

        if (cloudUrl) {
          publicPath = cloudUrl
        } else {
          const absDir = path.join(UPLOADS_DIR, rules.folder)
          await fs.mkdir(absDir, { recursive: true })
          const absPath = path.join(absDir, filename)
          await fs.writeFile(absPath, file.buffer)
        }

        const item = {
          id,
          type,
          title,
          path: publicPath,
          mime: file.mimetype || undefined,
          createdAt: new Date().toISOString(),
          originalName: file.originalname,
        }
        const manifest = await addManifestItem(item)
        res.status(201).json({ item, manifest })
      } catch (err) {
        console.error('[upload]', err)
        res.status(500).json({ error: 'Upload failed' })
      }
    },
  )

  app.delete('/api/delete', requireAuth, async (req, res) => {
    try {
      const id = String(req.body?.id ?? req.query?.id ?? '')
      if (!id) {
        res.status(400).json({ error: 'Missing id' })
        return
      }
      const { removed, manifest } = await removeManifestItem(id)
      if (!removed) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      const abs = resolveUploadPath(removed.path)
      if (abs) {
        try {
          await fs.unlink(abs)
        } catch {
          /* file may already be gone */
        }
      } else if (/^https?:\/\//i.test(removed.path)) {
        await deleteFromSupabase(removed.path)
      }
      res.json({ ok: true, removed, manifest })
    } catch (err) {
      console.error('[delete]', err)
      res.status(500).json({ error: 'Delete failed' })
    }
  })

  // Static uploads (works even if Vite isn't copying them)
  app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: true }))

  // Production: serve built site + admin
  const distDir = path.join(ROOT, 'dist')
  const publicDir = path.join(ROOT, 'public')
  app.use(express.static(distDir))
  app.use(express.static(publicDir))

  const adminHtml = path.join(publicDir, 'admin', 'index.html')
  const pagesBase = '/Levi-Zigza-Artist-Portfolio'
  // Trailing slash so relative ./admin.css + ./admin.js resolve correctly.
  // Serve under both `/admin/` (npm start) and the GitHub Pages base path.
  for (const root of ['/admin', `${pagesBase}/admin`]) {
    app.get(root, (_req, res) => {
      res.redirect(301, `${root}/`)
    })
    app.get(`${root}/`, (_req, res) => {
      res.sendFile(adminHtml)
    })
  }

  // SPA fallback for portfolio shell (not /api, not admin)
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
      next()
      return
    }
    if (req.path === pagesBase || req.path === `${pagesBase}/`) {
      res.sendFile(path.join(distDir, 'index.html'), (err) => {
        if (err) next()
      })
      return
    }
    if (
      req.path === `${pagesBase}/admin` ||
      req.path.startsWith(`${pagesBase}/admin/`)
    ) {
      next()
      return
    }
    res.sendFile(path.join(distDir, 'index.html'), (err) => {
      if (err) next()
    })
  })

  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message })
      return
    }
    if (err?.type === 'entity.parse.failed' || err?.status === 400) {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  })

  app.listen(PORT, () => {
    console.log(`Levi Zigza API listening on http://localhost:${PORT}`)
    if (!ADMIN_PASSWORD) {
      console.warn('WARNING: ADMIN_PASSWORD is unset — login will return 503.')
    }
    if (isSupabaseConfigured()) {
      console.log('Supabase Storage: enabled (portfolio bucket)')
    } else {
      console.log('Supabase Storage: off — using local public/uploads/')
    }
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
