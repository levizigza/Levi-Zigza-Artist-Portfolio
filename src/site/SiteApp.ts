/**
 * Inner portfolio shell — creative cosmos chrome + planetfall chamber worlds
 * with Star Trek–homage transporter transitions between tabs.
 */

import { fetchLoreSnippet, formatLoreQuote } from '../content/loreApi'
import { CassetteDeck } from './CassetteDeck'
import { ChamberLife, type BeatSource } from './ChamberLife'
import { hydrateChambers } from './hydrateChambers'
import { TabletChamber } from './TabletChamber'
import { TeleportBeam } from './TeleportBeam'
import './chambers.css'

export type SiteHandlers = {
  onReturnJourney: () => void
  onChamberChange?: (page: string) => void
  onTeleport?: () => void
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
  private currentPage = 'home'
  private warpBusy = false
  private signalEl: HTMLElement | null = null
  private reducedMotion = false

  constructor(root: HTMLElement, handlers: SiteHandlers, beat: BeatSource) {
    this.root = root
    this.handlers = handlers
    this.pages = root.querySelectorAll<HTMLElement>('.site-page')
    this.navLinks = root.querySelectorAll<HTMLAnchorElement>('[data-nav]')
    this.deck = new CassetteDeck(root)
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
        if (page) this.showPage(page)
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
    } catch {
      /* keep placeholders */
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
    this.root.classList.remove('visible')
    this.root.setAttribute('aria-hidden', 'true')
    this.life.stop()
    window.setTimeout(() => this.root.classList.add('hidden'), 500)
  }

  showPage(id: string): void {
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

      this.beam.play(
        () => this.applyPage(id, true),
        () => {
          this.warpBusy = false
        },
      )
      return
    }

    this.applyPage(id, arriving)
  }

  private applyPage(id: string, animate: boolean): void {
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
