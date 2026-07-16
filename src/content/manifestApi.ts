/**
 * Portfolio media manifest — loaded from the admin API / uploads.
 * Fails soft when the API is offline so placeholders stay.
 *
 * Resolve order (GitHub Pages friendly):
 * 1. `/api/manifest` (Express / Worker / local Vite proxy)
 * 2. Supabase public `portfolio/manifest.json` (when VITE_SUPABASE_URL is set)
 * 3. Static `public/uploads/manifest.json` committed with the site
 */

import { withBase } from './withBase'

export type MediaType = 'video' | 'photo' | 'audio' | 'script'

export type ManifestItem = {
  id: string
  type: MediaType
  title: string
  path: string
  mime?: string
  createdAt: string
  originalName?: string
}

export type Manifest = {
  items: ManifestItem[]
}

const EMPTY: Manifest = { items: [] }

function normalizeItem(item: ManifestItem): ManifestItem {
  return { ...item, path: withBase(item.path) }
}

function parseManifest(data: unknown): Manifest | null {
  if (!data || typeof data !== 'object') return null
  const items = (data as Manifest).items
  if (!Array.isArray(items)) return null
  return { items: items.map(normalizeItem) }
}

function supabaseManifestUrl(): string | null {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!base) return null
  const bucket = (import.meta.env.VITE_SUPABASE_BUCKET as string | undefined) || 'portfolio'
  return `${base}/storage/v1/object/public/${bucket}/manifest.json`
}

async function fetchJsonManifest(url: string): Promise<Manifest | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return parseManifest(await res.json())
  } catch {
    return null
  }
}

async function fetchStaticManifest(): Promise<Manifest> {
  return (await fetchJsonManifest(withBase('/uploads/manifest.json'))) ?? EMPTY
}

async function fetchSupabaseManifest(): Promise<Manifest | null> {
  const url = supabaseManifestUrl()
  if (!url) return null
  return fetchJsonManifest(url)
}

export async function fetchManifest(timeoutMs = 4000): Promise<Manifest> {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    // Root-absolute so Vite's `/api` proxy still works in local dev (base may be a subpath).
    const res = await fetch('/api/manifest', {
      signal: controller.signal,
      credentials: 'same-origin',
    })
    clearTimeout(timer)
    if (res.ok) {
      const parsed = parseManifest(await res.json())
      if (parsed) return parsed
    }
  } catch {
    // API offline / timeout — try cloud / static below
  }

  const fromCloud = await fetchSupabaseManifest()
  if (fromCloud) return fromCloud

  // GitHub Pages & static hosts: committed public/uploads/manifest.json
  return fetchStaticManifest()
}

export function itemsOfType(manifest: Manifest, type: MediaType): ManifestItem[] {
  return manifest.items.filter((i) => i.type === type)
}
