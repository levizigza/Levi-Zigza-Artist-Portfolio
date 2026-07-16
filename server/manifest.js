import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncManifestToSupabase } from './supabaseStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const UPLOADS_DIR = path.join(ROOT, 'public', 'uploads')
export const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json')

/** @typedef {'video' | 'photo' | 'audio' | 'script'} MediaType */

/**
 * @typedef {object} ManifestItem
 * @property {string} id
 * @property {MediaType} type
 * @property {string} title
 * @property {string} path
 * @property {string} [mime]
 * @property {string} createdAt
 * @property {string} [originalName]
 */

/**
 * @typedef {object} Manifest
 * @property {ManifestItem[]} items
 */

const EMPTY = /** @type {Manifest} */ ({ items: [] })

export async function ensureUploadsLayout() {
  const dirs = ['video', 'photo', 'audio', 'script']
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  for (const d of dirs) {
    await fs.mkdir(path.join(UPLOADS_DIR, d), { recursive: true })
  }
  try {
    await fs.access(MANIFEST_PATH)
  } catch {
    await writeManifest(EMPTY)
  }
}

/** @returns {Promise<Manifest>} */
export async function readManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.items)) return { items: [] }
    return { items: data.items }
  } catch {
    return { items: [] }
  }
}

/** @param {Manifest} manifest */
export async function writeManifest(manifest) {
  const payload = `${JSON.stringify({ items: manifest.items }, null, 2)}\n`
  await fs.writeFile(MANIFEST_PATH, payload, 'utf8')
  // Best-effort cloud mirror for GitHub Pages / Workers
  try {
    await syncManifestToSupabase(manifest)
  } catch (err) {
    console.warn('[manifest] supabase sync skipped:', err?.message || err)
  }
}

/**
 * @param {ManifestItem} item
 * @returns {Promise<Manifest>}
 */
export async function addManifestItem(item) {
  const manifest = await readManifest()
  manifest.items.unshift(item)
  await writeManifest(manifest)
  return manifest
}

/**
 * @param {string} id
 * @returns {Promise<{ removed: ManifestItem | null, manifest: Manifest }>}
 */
export async function removeManifestItem(id) {
  const manifest = await readManifest()
  const idx = manifest.items.findIndex((i) => i.id === id)
  if (idx === -1) return { removed: null, manifest }
  const [removed] = manifest.items.splice(idx, 1)
  await writeManifest(manifest)
  return { removed, manifest }
}

/**
 * Resolve a public `/uploads/...` path to an absolute file path under uploads.
 * Cloud https URLs return null (handled by Supabase delete).
 * @param {string} publicPath
 * @returns {string | null}
 */
export function resolveUploadPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return null
  if (/^https?:\/\//i.test(publicPath)) return null
  const normalized = publicPath.replace(/\\/g, '/')
  if (!normalized.startsWith('/uploads/')) return null
  const rel = normalized.slice('/uploads/'.length)
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return null
  const abs = path.resolve(UPLOADS_DIR, rel)
  if (!abs.startsWith(UPLOADS_DIR)) return null
  return abs
}
