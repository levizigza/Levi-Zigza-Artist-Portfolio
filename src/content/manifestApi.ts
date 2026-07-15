/**
 * Portfolio media manifest — loaded from the admin API / uploads.
 * Fails soft when the API is offline so placeholders stay.
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

async function fetchStaticManifest(): Promise<Manifest> {
  try {
    const res = await fetch(withBase('/uploads/manifest.json'), { cache: 'no-store' })
    if (!res.ok) return EMPTY
    return parseManifest(await res.json()) ?? EMPTY
  } catch {
    return EMPTY
  }
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
    // API offline / timeout — try static file below
  }
  // GitHub Pages & static hosts: committed public/uploads/manifest.json
  return fetchStaticManifest()
}

export function itemsOfType(manifest: Manifest, type: MediaType): ManifestItem[] {
  return manifest.items.filter((i) => i.type === type)
}
