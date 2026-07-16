/**
 * Optional Supabase Storage backend for admin uploads.
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, files and the
 * public manifest live in the `portfolio` bucket. Local disk remains the
 * fallback so `npm run dev` works without cloud credentials.
 */

import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.SUPABASE_BUCKET || 'portfolio'

let client = null
let warnedMissing = false

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function getClient() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
  }
  return client
}

export function publicObjectUrl(objectPath) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  if (!base || !objectPath) return null
  return `${base}/storage/v1/object/public/${BUCKET}/${objectPath.replace(/^\//, '')}`
}

export function manifestPublicUrl() {
  return publicObjectUrl('manifest.json')
}

/**
 * Upload a buffer to `{folder}/{filename}` and return the public URL.
 * @param {{ folder: string, filename: string, buffer: Buffer, contentType?: string }} opts
 */
export async function uploadToSupabase({ folder, filename, buffer, contentType }) {
  const sb = getClient()
  if (!sb) {
    if (!warnedMissing) {
      console.warn('[supabase] Not configured — using local disk uploads.')
      warnedMissing = true
    }
    return null
  }

  const objectPath = `${folder}/${filename}`
  const { error } = await sb.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)

  const { data } = sb.storage.from(BUCKET).getPublicUrl(objectPath)
  return data?.publicUrl || publicObjectUrl(objectPath)
}

/**
 * Remove a storage object. Accepts a public URL or a bucket-relative path.
 * @param {string} pathOrUrl
 */
export async function deleteFromSupabase(pathOrUrl) {
  const sb = getClient()
  if (!sb || !pathOrUrl) return false

  const objectPath = objectPathFromUrl(pathOrUrl)
  if (!objectPath || objectPath === 'manifest.json') return false

  const { error } = await sb.storage.from(BUCKET).remove([objectPath])
  if (error) {
    console.warn('[supabase] delete:', error.message)
    return false
  }
  return true
}

/**
 * Sync the media manifest JSON to the public bucket so GitHub Pages can
 * fetch it without Express.
 * @param {{ items: unknown[] }} manifest
 */
export async function syncManifestToSupabase(manifest) {
  const sb = getClient()
  if (!sb) return false

  const body = Buffer.from(`${JSON.stringify({ items: manifest.items ?? [] }, null, 2)}\n`, 'utf8')
  const { error } = await sb.storage.from(BUCKET).upload('manifest.json', body, {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '60',
  })
  if (error) {
    console.warn('[supabase] manifest sync:', error.message)
    return false
  }
  return true
}

/**
 * @param {string} pathOrUrl
 * @returns {string | null}
 */
export function objectPathFromUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null
  const s = pathOrUrl.trim()

  // Already a relative object key like video/abc.mp4
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/')) {
    if (s.includes('..')) return null
    return s.replace(/^\//, '')
  }

  try {
    const u = new URL(s)
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    const rel = decodeURIComponent(u.pathname.slice(idx + marker.length))
    if (!rel || rel.includes('..')) return null
    return rel
  } catch {
    return null
  }
}

export function supabaseBucket() {
  return BUCKET
}
