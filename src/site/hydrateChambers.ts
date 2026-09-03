/**
 * Hydrate chamber galleries from the media manifest.
 * Keeps HTML placeholders when a type has no uploads.
 */

import {
  fetchManifest,
  itemsOfType,
  type Manifest,
  type ManifestItem,
} from '../content/manifestApi'

const CASS_TONES = ['', 'cass-tone-loop', 'cass-tone-score', 'cass-tone-orbit']
const SIGILS = ['◎', '▣', '◈', '◇', '⬡', '✦']

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function padTc(n: number): string {
  return String(n).padStart(2, '0')
}

function cassetteHtml(item: ManifestItem, index: number): string {
  const tone = CASS_TONES[index % CASS_TONES.length]
  const num = padTc(index + 1)
  const toneClass = tone ? ` ${tone}` : ''
  return `
    <button type="button" class="cassette" data-track="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" data-src="${escapeHtml(item.path)}" data-side="A">
      <span class="cass-shell${toneClass}">
        <span class="cass-screw s1"></span><span class="cass-screw s2"></span>
        <span class="cass-screw s3"></span><span class="cass-screw s4"></span>
        <span class="cass-label-plate">
          <span class="cass-side">A</span>
          <span class="cass-label">${num} · ${escapeHtml(item.title)}</span>
        </span>
        <span class="cass-window">
          <span class="cass-reel"></span>
          <span class="cass-reel"></span>
          <span class="cass-bridge"></span>
        </span>
        <span class="cass-teeth" aria-hidden="true"></span>
      </span>
      <span class="cass-spine" aria-hidden="true"></span>
    </button>`
}

function filmFrameHtml(item: ManifestItem, index: number): string {
  const sigil = SIGILS[index % SIGILS.length]
  const isVideo = /\.(mp4|webm|mov)$/i.test(item.path) || (item.mime?.startsWith('video') ?? false)
  const media = isVideo
    ? `<video class="film-media" src="${escapeHtml(item.path)}" muted loop playsinline preload="metadata"></video>`
    : `<img class="film-media" src="${escapeHtml(item.path)}" alt="" loading="lazy" />`
  return `
    <article class="film-frame has-media" data-delay="${index % 4}" data-id="${escapeHtml(item.id)}">
      <div class="film-cell">
        ${media}
        <div class="film-grain"></div>
        <span class="film-sigil">${sigil}</span>
        <span class="film-timecode">${padTc(0)}:${padTc(0)}:${padTc(index + 1)}</span>
      </div>
      <span class="altar-label">${escapeHtml(item.title)}</span>
    </article>`
}

function printHtml(item: ManifestItem, index: number): string {
  return `
    <figure
      class="print-clip has-media"
      data-hold="${index}"
      data-id="${escapeHtml(item.id)}"
      data-src="${escapeHtml(item.path)}"
      data-title="${escapeHtml(item.title)}"
      role="button"
      tabindex="0"
    >
      <div class="print-sheet">
        <img class="print-media" src="${escapeHtml(item.path)}" alt="${escapeHtml(item.title)}" loading="lazy" />
      </div>
      <figcaption class="altar-label">${escapeHtml(item.title)}</figcaption>
    </figure>`
}

const SERIES_ORDER = ['chromatic', 'portraiture', 'urban', 'events', 'nature', 'still-life'] as const

const SERIES_META: Record<string, { label: string; note: string }> = {
  chromatic: {
    label: 'Chromatic Studies',
    note: 'Saturated gels, dual-tone nights, color as subject.',
  },
  portraiture: {
    label: 'Portraiture',
    note: 'Presence, glance, and the quiet between expressions.',
  },
  urban: {
    label: 'Urban Geometry',
    note: 'Glass, steel, shadow lines carved through the city.',
  },
  events: {
    label: 'Gatherings',
    note: 'Rooms in motion - conversation, ceremony, community heat.',
  },
  nature: {
    label: 'Natural Frame',
    note: 'Wing, water, and sky held in a single beat.',
  },
  'still-life': {
    label: 'Still Life',
    note: 'Craft on the board - texture before the plate.',
  },
}

function groupPhotos(items: ManifestItem[]): { key: string; label: string; note: string; items: ManifestItem[] }[] {
  const buckets = new Map<string, ManifestItem[]>()
  for (const item of items) {
    const key = item.category || 'archive'
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }

  const ordered: { key: string; label: string; note: string; items: ManifestItem[] }[] = []
  for (const key of SERIES_ORDER) {
    const list = buckets.get(key)
    if (!list?.length) continue
    const meta = SERIES_META[key]
    ordered.push({
      key,
      label: list[0].categoryLabel || meta?.label || key,
      note: meta?.note || '',
      items: list,
    })
    buckets.delete(key)
  }

  for (const [key, list] of buckets) {
    if (!list.length) continue
    ordered.push({
      key,
      label: list[0].categoryLabel || 'Archive',
      note: '',
      items: list,
    })
  }
  return ordered
}

function hydratePhoto(root: HTMLElement, items: ManifestItem[]): void {
  if (!items.length) return
  const archive = root.querySelector('#photo-archive')
  if (!archive) {
    const hanging = root.querySelector('#hanging-prints')
    if (!hanging) return
    hanging.innerHTML = items.map((item, i) => printHtml(item, i)).join('')
    return
  }

  const groups = groupPhotos(items)
  let printIndex = 0

  const nav = groups
    .map(
      (g, i) =>
        `<a class="photo-series-jump" href="#series-${escapeHtml(g.key)}">
          <span class="photo-series-jump-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="photo-series-jump-label">${escapeHtml(g.label)}</span>
        </a>`,
    )
    .join('')

  const sections = groups
    .map((g, si) => {
      const prints = g.items
        .map((item) => {
          const html = printHtml(item, printIndex)
          printIndex++
          return html
        })
        .join('')
      return `
        <section class="photo-series" id="series-${escapeHtml(g.key)}" data-series="${escapeHtml(g.key)}">
          <header class="photo-series-head">
            <p class="photo-series-kicker">Series ${String(si + 1).padStart(2, '0')}</p>
            <h3 class="photo-series-title">${escapeHtml(g.label)}</h3>
            ${g.note ? `<p class="photo-series-note">${escapeHtml(g.note)}</p>` : ''}
          </header>
          <div class="hanging-prints">${prints}</div>
        </section>`
    })
    .join('')

  archive.innerHTML = `
    <nav class="photo-series-nav" aria-label="Photograph series">${nav}</nav>
    ${sections}`
}

async function loadScriptPreview(item: ManifestItem): Promise<string[]> {
  try {
    const res = await fetch(item.path)
    if (!res.ok) return [item.title]
    const text = (await res.text()).trim()
    if (!text) return [item.title]
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 24)
    return lines.length ? lines : [item.title]
  } catch {
    return [item.title]
  }
}

function hydrateFilm(root: HTMLElement, items: ManifestItem[]): void {
  if (!items.length) return
  const frames = root.querySelector('.film-frames')
  if (!frames) return
  frames.innerHTML = items.map((item, i) => filmFrameHtml(item, i)).join('')
}

function hydrateMusic(root: HTMLElement, items: ManifestItem[]): void {
  if (!items.length) return
  const rack = root.querySelector('#cassette-rack')
  if (!rack) return
  rack.innerHTML = items.map((item, i) => cassetteHtml(item, i)).join('')
}

async function hydrateScripts(root: HTMLElement, items: ManifestItem[]): Promise<void> {
  if (!items.length) return
  const column = root.querySelector('#liturgy-column')
  const scripts = root.querySelector('.tablet-scripts')
  if (!column || !scripts) return

  const allLines: string[] = []
  const buttons: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const lines = await loadScriptPreview(item)
    const key = item.id
    buttons.push(`
      <button type="button" class="tablet-inscription" data-script="${escapeHtml(key)}" data-script-title="${escapeHtml(item.title)}">
        <span class="inscribe-mark">✎</span>
        <span class="altar-label">${escapeHtml(item.title)}</span>
      </button>`)
    for (const line of lines.slice(0, 6)) {
      allLines.push(
        `<p class="tablet-line" data-script-key="${escapeHtml(key)}">${escapeHtml(line.slice(0, 160))}</p>`,
      )
    }
  }

  if (allLines.length) {
    column.innerHTML = allLines.join('')
  }
  scripts.innerHTML = buttons.join('')
}

export async function hydrateChambers(root: HTMLElement): Promise<Manifest> {
  const manifest = await fetchManifest()
  hydrateFilm(root, itemsOfType(manifest, 'video'))
  hydrateMusic(root, itemsOfType(manifest, 'audio'))
  hydratePhoto(root, itemsOfType(manifest, 'photo'))
  await hydrateScripts(root, itemsOfType(manifest, 'script'))
  return manifest
}
