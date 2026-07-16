/**
 * Inner portfolio shell — creative cosmos chrome + planetfall chamber worlds
 * with Star Trek–homage transporter transitions between tabs.
 */

import { fetchLoreSnippet, formatLoreQuote } from '../content/loreApi'
import { CassetteDeck } from './CassetteDeck'
import { ChamberLife, type BeatSource } from './ChamberLife'
import { FilmStripAudio } from './FilmStripAudio'
import { hydrateChambers } from './hydrateChambers'
import { TabletChamber } from './TabletChamber'
import { TeleportBeam } from './TeleportBeam'
import './chambers.css'

export type SiteHandlers = {
  onReturnJourney: () => void
  onChamberChange?: (page: string) => void
  onTeleport?: () => void
  /** Chamber media (Walkman / film) claiming exclusive audio focus. */
  onMediaExclusive?: (active: boolean) => void
}

const PLANET_SIGNAL: Record<string, string> = {
  home: 'ORBITAL HUB',
  video: 'JUPITER · FILM STRIP',
  music: 'SATURN · WALKMAN',
  scripts: 'MERCURY · TABLET',
  photography: 'MARS · DARKROOM',
}

export class SiteApp {
  private root: HTMLElement
  private pages: NodeListOf<HTMLElement>
  private navLinks: NodeListOf<HTMLAnchorElement>
  private handlers: SiteHandlers
  private life: ChamberLife
  private beam: TeleportBeam
  private deck: CassetteDeck
  private film: FilmStripAudio
  private currentPage = 'home'
  private warpBusy = false
  private signalEl: HTMLElement | null = null
  private reducedMotion = false

  constructor(root: HTMLElement, handlers: SiteHandlers, beat: BeatSource) {
    this.root = root
    this.handlers = handlers
    this.pages = root.querySelectorAll<HTMLElement>('.site-page')
    this.navLinks = root.querySelectorAll<HTMLAnchorElement>('[data-nav]')
    this.deck = new CassetteDeck(root, {
      onPlaybackChange: (playing) => this.handlers.onMediaExclusive?.(playing),
    })
    this.film = new FilmStripAudio(root, {
      onExclusiveChange: (active) => this.handlers.onMediaExclusive?.(active),
    })
    new TabletChamber(root)
    this.life = new ChamberLife(root, {
      getLevel: () => Math.max(beat.getLevel(), this.deck.getLevel() * 0.7),
    })
    this.beam = new TeleportBeam(root)
    this.signalEl = root.querySelector('.site-signal')
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const page = link.dataset.nav
        if (page) this.showPage(page, link)
      })
    })

    const ret = document.getElementById('return-journey')
    ret?.addEventListener('click', () => this.handlers.onReturnJourney())

    void this.loadOptionalLore()
    void this.loadChamberMedia()
  }

  private async loadChamberMedia(): Promise<void> {
    try {
      await hydrateChambers(this.root)
      this.film.bind()
    } catch {
      /* keep placeholders */
      this.film.bind()
    }
  }

  show(): void {
    this.root.classList.remove('hidden')
    this.root.setAttribute('aria-hidden', 'false')
    requestAnimationFrame(() => this.root.classList.add('visible'))
    this.life.start()
    this.life.setPage(this.currentPage)
    this.updateSignal(this.currentPage)
  }

  hide(): void {
    this.silenceMedia()
    this.root.classList.remove('visible')
    this.root.setAttribute('aria-hidden', 'true')
    this.life.stop()
    window.setTimeout(() => this.root.classList.add('hidden'), 500)
  }

  /** Stop Walkman + film focus (Cosmos return / leave site). */
  silenceMedia(): void {
    this.deck.silence()
    this.film.release()
  }

  showPage(id: string, fromEl?: HTMLElement | null): void {
    if (id === this.currentPage && this.root.classList.contains('visible')) {
      this.applyPage(id, false)
      return
    }

    const arriving =
      this.root.classList.contains('visible') && id !== this.currentPage

    if (arriving && !this.warpBusy) {
      this.warpBusy = true
      this.handlers.onTeleport?.()
      this.life.triggerPlanetfall()

      if (this.reducedMotion) {
        this.applyPage(id, false)
        this.warpBusy = false
        return
      }

      const originX = this.beamOriginX(id, fromEl)
      this.beam.play(
        () => this.applyPage(id, true),
        () => {
          this.warpBusy = false
        },
        originX,
      )
      return
    }

    this.applyPage(id, arriving)
  }

  /**
   * Holobeam ceiling origin = the tab the user actually clicked.
   * Portal cards still cast from the matching top-nav tab so the emitter
   * stays on the chrome, not a mid-page card.
   */
  private beamOriginX(pageId: string, fromEl?: HTMLElement | null): number {
    const tab =
      (fromEl?.closest('.site-tab') as HTMLElement | null) ??
      this.root.querySelector<HTMLElement>(`.site-tab[data-nav="${pageId}"]`)
    const target = tab ?? fromEl
    if (target) {
      const r = target.getBoundingClientRect()
      return r.left + r.width * 0.5
    }
    return window.innerWidth * 0.5
  }

  private applyPage(id: string, animate: boolean): void {
    const leaving = this.currentPage
    if (leaving === 'music' && id !== 'music') this.deck.silence()
    if (leaving === 'video' && id !== 'video') this.film.release()

    this.currentPage = id
    this.pages.forEach((page) => {
      const active = page.dataset.page === id
      page.classList.toggle('active', active)
      if (active && animate) {
        page.style.animation = 'none'
        void page.offsetWidth
        page.style.animation = ''
      }
    })
    this.navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === id)
    })
    this.life.setPage(id)
    this.updateSignal(id)
    this.handlers.onChamberChange?.(id)
    this.root.scrollTo({ top: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' })
  }

  private updateSignal(id: string): void {
    if (!this.signalEl) return
    this.signalEl.textContent = PLANET_SIGNAL[id] ?? 'CREATIVE COSMOS'
  }

  private async loadOptionalLore(): Promise<void> {
    const el = document.getElementById('lore-quote')
    if (!el) return
    const lore = await fetchLoreSnippet()
    if (!lore) return
    el.textContent = formatLoreQuote(lore)
    el.hidden = false
  }
}
