/**
 * Portfolio media manifest — loaded from the admin API / uploads.
 * Fails soft when the API is offline so placeholders stay.
 */

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

export async function fetchManifest(timeoutMs = 4000): Promise<Manifest> {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch('/api/manifest', {
      signal: controller.signal,
      credentials: 'same-origin',
    })
    clearTimeout(timer)
    if (!res.ok) return EMPTY
    const data = (await res.json()) as Manifest
    if (!data || !Array.isArray(data.items)) return EMPTY
    return { items: data.items }
  } catch {
    // Fall back to static manifest (works without the API process)
    try {
      const res = await fetch('/uploads/manifest.json', { cache: 'no-store' })
      if (!res.ok) return EMPTY
      const data = (await res.json()) as Manifest
      if (!data || !Array.isArray(data.items)) return EMPTY
      return { items: data.items }
    } catch {
      return EMPTY
    }
  }
}

export function itemsOfType(manifest: Manifest, type: MediaType): ManifestItem[] {
  return manifest.items.filter((i) => i.type === type)
}
