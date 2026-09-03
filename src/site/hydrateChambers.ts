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
  const youtubeId = item.youtubeId || extractYoutubeId(item.externalUrl || item.path)
  const isFileVideo = /\.(mp4|webm|mov)$/i.test(item.path) || (item.mime?.startsWith('video') ?? false)
  const thumb = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : !isFileVideo && item.path
      ? item.path
      : ''

  let media = ''
  if (youtubeId) {
    media = `<img class="film-media" src="${escapeHtml(thumb)}" alt="" loading="lazy" />
        <span class="film-play" aria-hidden="true">▶</span>`
  } else if (isFileVideo) {
    media = `<video class="film-media" src="${escapeHtml(item.path)}" muted loop playsinline preload="metadata"></video>`
  } else if (thumb) {
    media = `<img class="film-media" src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
  }

  const ytAttr = youtubeId ? ` data-youtube-id="${escapeHtml(youtubeId)}"` : ''
  const titleAttr = ` data-title="${escapeHtml(item.title)}"`
  const href = item.externalUrl ? ` data-external="${escapeHtml(item.externalUrl)}"` : ''

  return `
    <article class="film-frame has-media" data-delay="${index % 4}" data-id="${escapeHtml(item.id)}"${ytAttr}${titleAttr}${href}>
      <div class="film-cell">
        ${media}
        <div class="film-grain"></div>
        <span class="film-sigil">${sigil}</span>
        <span class="film-timecode">${padTc(0)}:${padTc(0)}:${padTc(index + 1)}</span>
      </div>
      <span class="altar-label">${escapeHtml(item.title)}</span>
    </article>`
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return m?.[1] ?? null
}

function cbcCardHtml(item: ManifestItem): string {
  const kind = item.mime?.includes('html') || item.subtitle?.toLowerCase().includes('article')
    ? 'article'
    : item.provider === 'cbc' && (item.externalUrl || '').includes('/player/')
      ? 'video'
      : 'story'
  const formatLabel =
    item.subtitle ||
    (kind === 'article' ? 'Article + audio' : kind === 'video' ? 'Broadcast video' : 'CBC News')
  const href = escapeHtml(item.externalUrl || item.path)
  const thumb = item.thumb || ''
  const thumbHtml = thumb
    ? `<div class="cbc-card-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy" /></div>`
    : `<div class="cbc-card-mark">
        <span class="cbc-wordmark">CBC</span>
        <span class="cbc-wordmark-sub">News</span>
      </div>`
  return `
    <a class="cbc-card cbc-card-${kind}${thumb ? ' has-thumb' : ''}" href="${href}" target="_blank" rel="noopener noreferrer">
      ${thumbHtml}
      <div class="cbc-card-body">
        <p class="cbc-card-kicker">${escapeHtml(formatLabel)}</p>
        <h4 class="cbc-card-title">${escapeHtml(item.title)}</h4>
        ${item.credit ? `<p class="cbc-card-credit">${escapeHtml(item.credit)}</p>` : ''}
        <span class="cbc-card-cta">Open on CBC ↗</span>
      </div>
    </a>`
}

const VIDEO_SERIES: { key: string; label: string; note: string; kicker: string }[] = [
  {
    key: 'music-video',
    label: 'Music Videos',
    note: 'Official cuts and promo frames - click a cell to watch.',
    kicker: 'Reel',
  },
  {
    key: 'event-video',
    label: 'Event Videography',
    note: 'Live energy, stages, and rooms in motion.',
    kicker: 'Reel',
  },
  {
    key: 'urban-video',
    label: 'Urban Videography',
    note: 'City streets, downtown nights, and the pulse between blocks.',
    kicker: 'Reel',
  },
  {
    key: 'cbc-news',
    label: 'CBC News',
    note: 'Published work with CBC Calgary - article, audio, and broadcast.',
    kicker: 'Press wire',
  },
]

function filmStripBlock(label: string, items: ManifestItem[], startIndex: number): string {
  return `
    <div class="film-strip" data-chamber="video" aria-label="${escapeHtml(label)} film strip">
      <div class="film-sprockets film-sprockets-left" aria-hidden="true"></div>
      <div class="film-frames">${items.map((item, i) => filmFrameHtml(item, startIndex + i)).join('')}</div>
      <div class="film-sprockets film-sprockets-right" aria-hidden="true"></div>
    </div>`
}

function hydrateFilm(root: HTMLElement, items: ManifestItem[]): void {
  if (!items.length) return

  const archive = root.querySelector('#video-archive')
  if (!archive) {
    const frames = root.querySelector('.film-frames')
    if (!frames) return
    frames.innerHTML = items.map((item, i) => filmFrameHtml(item, i)).join('')
    return
  }

  const buckets = new Map<string, ManifestItem[]>()
  for (const item of items) {
    const key = item.category || 'music-video'
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }

  const sections: string[] = []
  const navBits: string[] = []
  let reelNum = 0
  let frameIndex = 0

  for (const series of VIDEO_SERIES) {
    const list = buckets.get(series.key)
    if (!list?.length) continue
    buckets.delete(series.key)
    reelNum++
    const num = String(reelNum).padStart(2, '0')
    const id = `series-${series.key}`
    navBits.push(
      `<a class="video-series-jump" href="#${id}"><span class="video-series-jump-num">${num}</span><span class="video-series-jump-label">${escapeHtml(series.label)}</span></a>`,
    )

    if (series.key === 'cbc-news') {
      sections.push(`
        <section class="video-series cbc-desk" id="${id}" data-series="${series.key}">
          <header class="video-series-head">
            <p class="video-series-kicker">${escapeHtml(series.kicker)}</p>
            <h3 class="video-series-title">${escapeHtml(series.label)}</h3>
            <p class="video-series-note">${escapeHtml(series.note)}</p>
          </header>
          <div class="cbc-grid">${list.map((item) => cbcCardHtml(item)).join('')}</div>
        </section>`)
    } else {
      const strip = filmStripBlock(series.label, list, frameIndex)
      frameIndex += list.length
      sections.push(`
        <section class="video-series" id="${id}" data-series="${series.key}">
          <header class="video-series-head">
            <p class="video-series-kicker">${escapeHtml(series.kicker)} ${num}</p>
            <h3 class="video-series-title">${escapeHtml(series.label)}</h3>
            <p class="video-series-note">${escapeHtml(series.note)}</p>
          </header>
          ${strip}
        </section>`)
    }
  }

  // Any leftover categories still render as film strips
  for (const [key, list] of buckets) {
    if (!list.length) continue
    reelNum++
    const num = String(reelNum).padStart(2, '0')
    const label = list[0].categoryLabel || key
    const id = `series-${escapeHtml(key)}`
    navBits.push(
      `<a class="video-series-jump" href="#${id}"><span class="video-series-jump-num">${num}</span><span class="video-series-jump-label">${escapeHtml(label)}</span></a>`,
    )
    const strip = filmStripBlock(label, list, frameIndex)
    frameIndex += list.length
    sections.push(`
      <section class="video-series" id="${id}" data-series="${escapeHtml(key)}">
        <header class="video-series-head">
          <p class="video-series-kicker">Reel ${num}</p>
          <h3 class="video-series-title">${escapeHtml(label)}</h3>
        </header>
        ${strip}
      </section>`)
  }

  archive.innerHTML = `
    <nav class="video-series-nav" aria-label="Video series">${navBits.join('')}</nav>
    ${sections.join('')}`

  archive.querySelectorAll<HTMLAnchorElement>('.video-series-jump').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const id = link.getAttribute('href')?.replace(/^#/, '')
      if (!id) return
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
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
  const isPdf =
    item.mime === 'application/pdf' ||
    /\.pdf$/i.test(item.path) ||
    /\.pdf$/i.test(item.originalName || '')

  if (isPdf) {
    return [
      `◇ ${item.title.toUpperCase()}`,
      '☰ MANUSCRIPT · sealed as PDF',
      item.subtitle ? `彡 ${item.subtitle}` : '彡 FULL TEXT · open the scroll',
      '···· pages bound in light ····',
    ]
  }

  try {
    const res = await fetch(item.path)
    if (!res.ok) return [item.title]
    const text = (await res.text()).trim()
    if (!text) return [item.title]
    // Binary PDF mistaken as text — avoid dumping garbage into the tablet
    if (text.startsWith('%PDF') || /[\u0000-\u0008]/.test(text.slice(0, 200))) {
      return [
        `◇ ${item.title.toUpperCase()}`,
        '☰ MANUSCRIPT · sealed as PDF',
        '彡 FULL TEXT · open the scroll',
      ]
    }
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
    const isPdf =
      item.mime === 'application/pdf' ||
      /\.pdf$/i.test(item.path) ||
      /\.pdf$/i.test(item.originalName || '')
    const hrefAttr = isPdf ? ` data-script-href="${escapeHtml(item.path)}"` : ''
    const mark = isPdf ? '☰' : '✎'
    buttons.push(`
      <button type="button" class="tablet-inscription${isPdf ? ' is-pdf' : ''}" data-script="${escapeHtml(key)}" data-script-title="${escapeHtml(item.title)}"${hrefAttr}>
        <span class="inscribe-mark">${mark}</span>
        <span class="altar-label">${escapeHtml(item.title)}</span>
        ${isPdf ? '<span class="altar-sub">Open PDF</span>' : ''}
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
