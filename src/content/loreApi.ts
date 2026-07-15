/**
 * Optional public-API flavor for monologue / home lore.
 * Never blocks the experience — fails silently offline.
 */

export type LoreSnippet = {
  text: string
  attribution?: string
}

/** PoetryDB random line — public, no key required. */
export async function fetchLoreSnippet(
  timeoutMs = 2500,
): Promise<LoreSnippet | null> {
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch('https://poetrydb.org/random/1/lines,author', {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const data = (await res.json()) as { lines?: string[]; author?: string }[]
    const poem = data?.[0]
    if (!poem?.lines?.length) return null

    const line =
      poem.lines.find((l) => l.trim().length > 20 && l.trim().length < 120) ??
      poem.lines[0]
    const text = line.trim()
    if (!text) return null

    return {
      text,
      attribution: poem.author,
    }
  } catch {
    return null
  }
}

/** Format for on-screen display. */
export function formatLoreQuote(snippet: LoreSnippet): string {
  const attr = snippet.attribution ? ` — ${snippet.attribution}` : ''
  return `“${snippet.text}”${attr}`
}
