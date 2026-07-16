/**
 * Levi Zigza title sequence —
 * potentiality ball (~0.22s) → punchy Boom → eye / solar-system gate →
 * Enter zoom + hyperspace → 8-bit origin myth → site.
 */

import { BigBang } from './BigBang'
import { CRTComposite } from './CRTComposite'
import {
  EyePortal,
  EYE,
  eyeBreath,
  eyeCrtGrade,
  eyeLayout,
  pupilLayout,
} from './EyePortal'
import { Hyperspace } from './Hyperspace'
import { LabyrinthScene } from './LabyrinthScene'
import { OriginStory, ORIGIN } from './OriginStory'
import { Paintbrush } from './Paintbrush'
import { PotentialitySphere, sphereLayout } from './PotentialitySphere'
import { labelForProgress } from './stages'

export type TitleSequenceCallbacks = {
  onProgress?: (t: number, label: string) => void
  /** Brief potentiality hold complete — main should fire boom. */
  onAutoEnter?: () => void
  /** Early/mid boom — eye gate is ready to receive the player. */
  onEyeReady?: () => void
  /** Dive / origin journey started — show Skip, start journey score. */
  onJourneyBegin?: () => void
  /** Site should emerge under the settle veil. */
  onSiteReveal?: () => void
  /** Arrival fully settled — canvas can rest. */
  onArrivalComplete?: () => void
  /** Dream-drone intensity 0–1 for Score (origin sleep / dream birth). */
  onAum?: (intensity: number) => void
  /** Bang swell 0–1 for Score. */
  onBang?: (intensity: number) => void
  /** Origin myth started — begin / rewind cowboy VO. */
  onOriginBegin?: () => void
  /** Last origin frame held — show Enter Site / Rewind (no auto-jump). */
  onStoryEnd?: () => void
  /** Left story-end hold (enter site or skip). */
  onStoryEndDismiss?: () => void
  /** Planet / cosmos flyby whoosh — fire one-shot SFX. */
  onPlanetWhoosh?: (intensity: number) => void
  /** Eye-sun / dream-sun heat crackle presence 0–1. */
  onSunHeat?: (intensity: number) => void
  /**
   * While holding the last frame, return true if VO still needs time.
   * Origin stays on the end hold until false (or user Enter / Rewind / Skip).
   */
  shouldHoldForNarration?: () => boolean
  /**
   * VO-driven origin localT (0–1). When set, origin visuals follow narration
   * beats instead of a free-running wall clock.
   */
  getNarrationVisual?: () => {
    localT: number
    cueIndex: number
    cueU: number
  } | null
}

type Phase =
  | 'potentiality'
  | 'bang'
  | 'eye'
  | 'dive'
  | 'origin'
  | 'storyEnd'
  | 'settle'
  | 'journey'
  | 'done'

/** Near-instant land on the small ball, then always auto-boom. */
const IDLE_HOLD_SEC = 0.22
/** Snappy detonation into the eye gate. */
const BANG_SEC = 1.2
/** Eye owns the frame as soon as the blast clears. */
const EYE_READY_AT = 0.48
/**
 * Dive timeline (~5.2s):
 *   0–~1.2s  zoom into pupil black
 *   ~1.0–5.0s cinematic streak hyperspace
 *   then origin myth
 */
const DIVE_SEC = 5.2
/** Fraction of dive where the eye still owns the frame (zoom into pupil). */
const DIVE_EYE_END = 0.28
/** Hyperspace fully opaque by this dive fraction. */
const DIVE_WARP_FULL = 0.22
/** Full origin myth (sleeper → dream cosmos → civs → boy/alchemist parable). */
/** Stretched for deep cowboy VO cadence (~4–6s per line + gaps). */
const ORIGIN_SEC = 80
/** Hold readable last parable frame (before origin’s end fade-to-black). */
const STORY_HOLD_LOCAL = 0.9
const SETTLE_SEC = 1.15

function smoothstep(a: number, b: number, t: number): number {
  if (t <= a) return 0
  if (t >= b) return 1
  const u = (t - a) / (b - a)
  return u * u * (3 - 2 * u)
}

export class TitleSequence {
  readonly canvas: HTMLCanvasElement
  private crt: CRTComposite
  private sphere: PotentialitySphere
  private bang: BigBang
  private eye: EyePortal
  private origin: OriginStory
  private scene: LabyrinthScene
  private brush: Paintbrush
  private hyperspace: Hyperspace
  private callbacks: TitleSequenceCallbacks
  private phase: Phase = 'potentiality'
  private phaseT = 0
  private idleT = 0
  private progress = 0
  private playing = false
  private idle = true
  private bangDuration = BANG_SEC
  private diveDuration = DIVE_SEC
  private originDuration = ORIGIN_SEC
  private settleDuration = SETTLE_SEC
  private journeyDuration = 72
  private raf = 0
  private lastTs = 0
  private lastLabel = ''
  private flash = 0
  private enterPulse = 0
  private eyeReady = false
  private journeyBegun = false
  private siteRevealed = false
  private arrivalComplete = false
  private roadBegun = false
  private lastAum = -1
  private lastBang = -1
  private hover = false
  private autoFired = false
  private canvasFade = 1
  private paintLayer: HTMLCanvasElement
  private diveBurst = 0

  constructor(canvas: HTMLCanvasElement, callbacks: TitleSequenceCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.crt = new CRTComposite(canvas)
    this.sphere = new PotentialitySphere()
    this.bang = new BigBang()
    this.eye = new EyePortal()
    this.origin = new OriginStory()
    this.scene = new LabyrinthScene()
    this.brush = new Paintbrush()
    this.hyperspace = new Hyperspace()
    this.paintLayer = document.createElement('canvas')
    this.onResize = this.onResize.bind(this)
    window.addEventListener('resize', this.onResize)
    this.onResize()
  }

  startIdlePreview(): void {
    this.idle = true
    this.playing = false
    this.phase = 'potentiality'
    this.phaseT = 0
    this.idleT = 0
    this.progress = 0
    this.eyeReady = false
    this.journeyBegun = false
    this.siteRevealed = false
    this.arrivalComplete = false
    this.roadBegun = false
    this.autoFired = false
    this.canvasFade = 1
    this.diveBurst = 0
    this.sphere.reset()
    this.bang.reset()
    this.origin.reset()
    this.scene.reset()
    this.hyperspace.reset()
    this.brush.resetPaint()
    this.lastTs = 0
    this.lastAum = -1
    this.lastBang = -1
    this.ensureLoop()
  }

  /**
   * Boom from potentiality — reveals the eye / solar system gate (not the site).
   */
  start(): void {
    this.idle = false
    this.playing = true
    this.phase = 'bang'
    this.phaseT = 0
    this.idleT = IDLE_HOLD_SEC
    this.progress = 0
    this.eyeReady = false
    this.journeyBegun = false
    this.siteRevealed = false
    this.arrivalComplete = false
    this.roadBegun = false
    this.canvasFade = 1
    this.diveBurst = 0
    this.bang.reset()
    this.origin.reset()
    this.scene.reset()
    this.hyperspace.reset()
    this.brush.resetPaint()
    this.lastLabel = ''
    this.lastTs = 0
    this.lastAum = -1
    this.lastBang = -1
    this.flash = 0.22
    this.callbacks.onProgress?.(0, 'big bang')
    this.ensureLoop()
  }

  /** Enter from the eye gate — zoom → hyperspace → origin story → site. */
  startJourney(): void {
    if (this.phase !== 'eye' && this.phase !== 'bang') return
    this.idle = false
    this.playing = true
    this.phase = 'dive'
    this.phaseT = 0
    this.progress = EYE.holdEnd
    this.diveBurst = 1
    this.journeyBegun = false
    this.siteRevealed = false
    this.arrivalComplete = false
    this.roadBegun = false
    this.canvasFade = 1
    this.origin.reset()
    this.hyperspace.reset()
    this.lastTs = 0
    this.lastLabel = ''
    this.flash = 0.12
    this.enterPulse = 1
    this.maybeJourneyBegin()
    this.emitWhoosh(0.95)
    this.callbacks.onProgress?.(this.progress, 'into the eye')
    this.ensureLoop()
  }

  /** @deprecated Prefer the full opening restart via startIdlePreview (Cosmos return). */
  startCosmicPath(): void {
    this.idle = false
    this.playing = true
    this.phase = 'journey'
    this.phaseT = 0
    this.progress = EYE.diveEnd
    this.roadBegun = true
    this.journeyBegun = true
    this.siteRevealed = false
    this.arrivalComplete = false
    this.canvasFade = 1
    this.scene.reset()
    this.lastTs = 0
    this.callbacks.onProgress?.(this.progress, labelForProgress(this.progress))
    this.ensureLoop()
  }

  setActive(active: boolean): void {
    this.playing = active
    if (this.phase === 'eye' || this.phase === 'potentiality') {
      this.idle = true
    } else {
      this.idle = !active
    }
    if (active) {
      this.ensureLoop()
    } else {
      cancelAnimationFrame(this.raf)
      this.raf = 0
      this.lastTs = 0
    }
  }

  resetProgress(): void {
    this.startIdlePreview()
    this.callbacks.onProgress?.(0, labelForProgress(0))
  }

  flashEnter(seconds = 1): void {
    this.flash = seconds
    this.enterPulse = 1
  }

  getProgress(): number {
    return this.progress
  }

  isIdle(): boolean {
    return this.idle || this.phase === 'eye' || this.phase === 'potentiality'
  }

  isEyeGate(): boolean {
    return this.phase === 'eye'
  }

  isPotentiality(): boolean {
    return this.phase === 'potentiality'
  }

  /** True while zooming / warping before the origin myth. */
  isDiving(): boolean {
    return this.phase === 'dive'
  }

  /** True during dive or origin — Enter skip is allowed once armed. */
  isJourneyStory(): boolean {
    return (
      this.phase === 'dive' ||
      this.phase === 'origin' ||
      this.phase === 'storyEnd' ||
      this.phase === 'settle'
    )
  }

  /** Last origin frame held — awaiting Enter Site or Rewind. */
  isStoryEnd(): boolean {
    return this.phase === 'storyEnd'
  }

  hasReachedRoad(): boolean {
    return this.roadBegun
  }

  hasRevealedSite(): boolean {
    return this.siteRevealed
  }

  setBrainHover(hover: boolean): void {
    this.hover = hover
  }

  setHover(hover: boolean): void {
    this.hover = hover
  }

  getBrainHitCss(): { cx: number; cy: number; size: number } {
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    if (this.phase === 'potentiality' || this.phase === 'bang') {
      return this.getSphereHitCss()
    }
    const p = pupilLayout(cssW, cssH, eyeBreath().scale)
    return { cx: p.brainCx, cy: p.brainCy, size: Math.max(28, p.brainSize) }
  }

  getSphereHitCss(): { cx: number; cy: number; size: number } {
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    const p = sphereLayout(cssW, cssH)
    return { cx: p.cx, cy: p.cy, size: Math.max(36, p.baseR * 2.8) }
  }

  /** Skip dive / origin / end-hold and settle into the site. */
  skipIntro(): void {
    if (
      this.phase !== 'dive' &&
      this.phase !== 'origin' &&
      this.phase !== 'storyEnd' &&
      this.phase !== 'settle'
    ) {
      return
    }
    if (this.phase === 'storyEnd') {
      this.callbacks.onStoryEndDismiss?.()
    }
    this.phase = 'settle'
    this.phaseT = 0
    this.emitAum(0)
    this.emitBang(0)
    this.maybeRevealSite()
  }

  /** @deprecated use skipIntro */
  skipMyth(): void {
    this.skipIntro()
  }

  /** Enter site from the last-frame hold (same settle path as Skip). */
  confirmEnterSite(): void {
    if (this.phase !== 'storyEnd' && this.phase !== 'origin') return
    this.callbacks.onStoryEndDismiss?.()
    this.phase = 'settle'
    this.phaseT = 0
    this.emitAum(0)
    this.emitBang(0)
    this.maybeRevealSite()
  }

  /** Restart origin myth + VO from the beginning (hyperspace optional / skipped). */
  rewindOrigin(): void {
    if (
      this.phase !== 'storyEnd' &&
      this.phase !== 'origin' &&
      this.phase !== 'settle'
    ) {
      return
    }
    if (this.phase === 'storyEnd') {
      this.callbacks.onStoryEndDismiss?.()
    }
    this.idle = false
    this.playing = true
    this.phase = 'origin'
    this.phaseT = 0
    this.progress = 0
    this.siteRevealed = false
    this.arrivalComplete = false
    this.canvasFade = 1
    this.origin.reset()
    this.lastTs = 0
    this.lastLabel = ''
    this.emitAum(0)
    this.callbacks.onOriginBegin?.()
    this.callbacks.onProgress?.(0.02, 'sleeper')
    this.ensureLoop()
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    window.removeEventListener('resize', this.onResize)
  }

  private onResize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    this.crt.resize(window.innerWidth, window.innerHeight, dpr)
    const w = this.crt.width
    const h = this.crt.height
    if (this.paintLayer.width !== w || this.paintLayer.height !== h) {
      this.paintLayer.width = w
      this.paintLayer.height = h
      this.brush.resetPaint()
    }
  }

  private ensureLoop(): void {
    if (this.raf) return
    const tick = (ts: number) => {
      this.raf = requestAnimationFrame(tick)
      const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0.016
      this.lastTs = ts
      this.frame(dt)
    }
    this.raf = requestAnimationFrame(tick)
  }

  private emitAum(intensity: number): void {
    if (Math.abs(intensity - this.lastAum) > 0.02) {
      this.lastAum = intensity
      this.callbacks.onAum?.(intensity)
    }
  }

  private emitBang(intensity: number): void {
    if (Math.abs(intensity - this.lastBang) > 0.02) {
      this.lastBang = intensity
      this.callbacks.onBang?.(intensity)
    }
  }

  private emitSunHeat(intensity: number): void {
    this.callbacks.onSunHeat?.(intensity)
  }

  private emitWhoosh(intensity = 0.85): void {
    this.callbacks.onPlanetWhoosh?.(intensity)
  }

  /** Pull flyby / sun SFX cues from eye gate or origin myth. */
  private syncIntroSfx(phase: Phase, localT = 0, hyperspace = 0): void {
    if (phase === 'eye' || phase === 'bang' || phase === 'dive') {
      if (this.eye.consumeFlybyWhoosh()) {
        const fly = Math.max(0.55, this.eye.getFlybyIntensity())
        this.emitWhoosh(0.7 + fly * 0.35)
      }
      const heat = this.eye.getSunHeatPresence(
        phase === 'eye' ? 0 : this.progress,
        phase === 'eye' || phase === 'bang',
        hyperspace,
      )
      this.emitSunHeat(heat)
      return
    }
    if (phase === 'origin') {
      if (this.origin.consumeCosmosWhoosh()) {
        this.emitWhoosh(0.75 + Math.random() * 0.25)
      }
      this.emitSunHeat(this.origin.getDreamHeat(localT) * 0.85)
      return
    }
    this.emitSunHeat(0)
  }

  private maybeEyeReady(): void {
    if (this.eyeReady) return
    this.eyeReady = true
    this.callbacks.onEyeReady?.()
  }

  private maybeJourneyBegin(): void {
    if (this.journeyBegun) return
    this.journeyBegun = true
    this.callbacks.onJourneyBegin?.()
  }

  private maybeRevealSite(): void {
    if (this.siteRevealed) return
    this.siteRevealed = true
    this.callbacks.onSiteReveal?.()
  }

  private maybeComplete(): void {
    if (this.arrivalComplete) return
    this.arrivalComplete = true
    this.phase = 'done'
    this.callbacks.onArrivalComplete?.()
  }

  private drawEyeIdle(
    ctx: CanvasRenderingContext2D,
    time: number,
    w: number,
    h: number,
    alpha = 1,
  ): void {
    const layout = eyeLayout(w, h)
    const pupilR = layout.baseR * 0.28
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    this.eye.draw(ctx, {
      progress: 0,
      time,
      width: w,
      height: h,
      idle: true,
      paintLayer: this.paintLayer,
      hyperspace: 0,
      showBrain: true,
      brainHover: this.hover,
    })
    ctx.save()
    ctx.globalAlpha = 0.95 * Math.max(0, Math.min(1, alpha))
    this.brush.draw(ctx, {
      progress: 0,
      time,
      width: w,
      height: h,
      painting: true,
      swayX: 0,
      swayY: 0,
      hero: true,
      eyeCx: layout.cx,
      eyeCy: layout.cy,
      eyeR: layout.baseR,
      pupilR,
      paintLayer: this.paintLayer,
    })
    ctx.restore()
    ctx.restore()
  }

  private frame(dt: number): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt)
    if (this.enterPulse > 0) this.enterPulse = Math.max(0, this.enterPulse - dt * 0.85)
    // Burst decays slower so Enter boom carries into the warp
    if (this.diveBurst > 0) this.diveBurst = Math.max(0, this.diveBurst - dt * 0.32)

    // Near-instant hold, then always auto-boom (do not wait on Enter)
    if (this.phase === 'potentiality') {
      this.idleT += dt
      if (!this.autoFired && this.idleT >= IDLE_HOLD_SEC) {
        this.autoFired = true
        this.callbacks.onAutoEnter?.()
      }
    }

    if (this.playing && this.phase !== 'potentiality' && this.phase !== 'eye') {
      this.advancePhase(dt)
    }

    const time = performance.now() / 1000
    const gradeIdle = this.phase === 'potentiality' || this.phase === 'eye' || this.phase === 'bang'
    this.crt.setGrade(eyeCrtGrade(this.progress, gradeIdle))
    // Arcade only for origin myth — dive keeps cinematic warp present
    this.crt.setArcade(this.phase === 'origin' || this.phase === 'storyEnd')
    const ctx = this.crt.beginFrame(dt)
    const w = this.crt.width
    const h = this.crt.height
    const layout = eyeLayout(w, h)
    const sphere = sphereLayout(w, h)

    ctx.save()
    ctx.globalAlpha = this.canvasFade

    if (this.phase === 'potentiality') {
      this.sphere.draw(ctx, {
        time,
        width: w,
        height: h,
        charge: 0,
        hover: this.hover ? 1 : 0,
      })
    } else if (this.phase === 'bang') {
      const u = Math.min(1, this.phaseT / this.bangDuration)
      // One quick beat of the drawn ball, then detonation — no gestation hold
      if (u < 0.03) {
        this.sphere.draw(ctx, {
          time,
          width: w,
          height: h,
          charge: 0.35,
          hover: 0,
        })
      } else {
        // Eye / cosmography rises early under the snap clear
        const eyeMix = smoothstep(0.16, 0.62, u)
        if (eyeMix > 0.02) this.drawEyeIdle(ctx, time, w, h, eyeMix)
      }
      this.bang.draw(ctx, {
        t: u,
        time,
        width: w,
        height: h,
        cx: sphere.cx,
        cy: sphere.cy,
      })
      // Showcase eye over late clear haze
      const late = smoothstep(0.35, 0.85, u)
      if (late > 0.02) this.drawEyeIdle(ctx, time, w, h, late * 0.92)
      this.emitBang(this.bang.intensity(u))
      if (u >= EYE_READY_AT) this.maybeEyeReady()
      this.syncIntroSfx('bang')
    } else if (this.phase === 'eye') {
      this.drawEyeIdle(ctx, time, w, h, 1)
      this.emitBang(0)
      this.syncIntroSfx('eye')
    } else if (this.phase === 'dive') {
      const u = Math.min(1, this.phaseT / this.diveDuration)
      const ease = u * u * (3 - 2 * u)
      this.progress = EYE.holdEnd + ease * (EYE.diveEnd - EYE.holdEnd)

      // Dive sub-phases: eye zoom → streak warp → boom into origin
      const zoomU = Math.min(1, u / DIVE_EYE_END)
      const zoomEase = zoomU * zoomU * (3 - 2 * zoomU)
      const warpT = Math.max(0, Math.min(1, (u - 0.08) / (1 - 0.08)))
      const eyeFade = 1 - smoothstep(DIVE_WARP_FULL * 0.85, DIVE_EYE_END, u)
      const hsAlpha = smoothstep(0.1, DIVE_WARP_FULL, u)

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)

      // Zoom into pupil black — eye stays long enough to read the dive
      if (eyeFade > 0.01) {
        ctx.save()
        ctx.globalAlpha = eyeFade
        this.eye.draw(ctx, {
          progress: this.progress,
          time,
          width: w,
          height: h,
          idle: false,
          paintLayer: this.paintLayer,
          hyperspace: Math.max(zoomEase, warpT * 0.35),
          showBrain: false,
          brainHover: false,
        })
        ctx.restore()
      }

      // Hyperspace owns the black of the pupil, then the full frame
      if (hsAlpha > 0.01 || this.diveBurst > 0.02) {
        ctx.save()
        ctx.globalAlpha = Math.min(1, Math.max(hsAlpha, this.diveBurst * 0.55))
        this.hyperspace.draw(ctx, {
          t: Math.max(warpT, this.diveBurst * 0.2),
          burst: this.diveBurst,
          time,
          width: w,
          height: h,
          cx: layout.cx,
          cy: layout.cy,
        })
        ctx.restore()
      }
      this.syncIntroSfx('dive', 0, Math.max(zoomEase, warpT))
    } else if (this.phase === 'origin' || this.phase === 'storyEnd') {
      const narr = this.callbacks.getNarrationVisual?.()
      const timeLocal = Math.min(STORY_HOLD_LOCAL, this.phaseT / this.originDuration)
      const localT =
        this.phase === 'storyEnd'
          ? Math.max(STORY_HOLD_LOCAL, narr?.localT ?? STORY_HOLD_LOCAL)
          : narr
            ? Math.min(1, Math.max(timeLocal * 0.15, narr.localT))
            : timeLocal
      // Draw at held frame; cue clock may already be at bloomEnd during storyEnd.
      const absProgress =
        this.phase === 'storyEnd' ? ORIGIN.bloomEnd : localT * ORIGIN.bloomEnd
      this.progress = absProgress

      ctx.fillStyle = '#000102'
      ctx.fillRect(0, 0, w, h)

      // Keep the parable readable on the end hold (skip fade-to-black).
      ctx.save()
      ctx.globalAlpha = 1
      this.origin.draw(ctx, {
        t: Math.min(1, localT),
        time,
        width: w,
        height: h,
        alpha: 1,
        cueIndex: narr?.cueIndex,
        cueU: narr?.cueU,
      })
      ctx.restore()
      this.emitAum(this.origin.aumIntensity(localT * ORIGIN.bloomEnd))
      this.syncIntroSfx('origin', localT)
    } else if (this.phase === 'settle') {
      const u = Math.min(1, this.phaseT / this.settleDuration)
      this.canvasFade = Math.max(0, 1 - u * u)
      this.maybeRevealSite()
      this.syncIntroSfx('settle')
      // Soft cream dissolve back to the site (post-myth, not arcade)
      const g = ctx.createRadialGradient(
        layout.cx,
        layout.cy,
        Math.min(w, h) * 0.05,
        layout.cx,
        layout.cy,
        Math.hypot(w, h) * 0.65,
      )
      g.addColorStop(0, `rgba(255, 248, 230, ${0.35 * (1 - u)})`)
      g.addColorStop(0.45, `rgba(8, 12, 28, ${0.55 + u * 0.3})`)
      g.addColorStop(1, `rgba(1, 2, 6, ${0.85 + u * 0.15})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    } else if (this.phase === 'journey') {
      const worldProgress = Math.max(
        0,
        (this.progress - EYE.diveEnd) / (1 - EYE.diveEnd),
      )
      const swayX = Math.sin(time * 1.1) * 8 + Math.sin(time * 0.37) * 5
      const swayY = Math.cos(time * 0.9) * 4
      this.scene.syncBricks(worldProgress)
      this.scene.draw(ctx, {
        progress: worldProgress,
        time,
        width: w,
        height: h,
        swayX,
        swayY,
        idle: false,
      })
    } else if (this.phase === 'done') {
      ctx.fillStyle = `rgba(1, 2, 6, ${this.canvasFade})`
      ctx.fillRect(0, 0, w, h)
      this.syncIntroSfx('done')
    }

    if (this.flash > 0 || this.enterPulse > 0) {
      const a = Math.max(this.flash / 1.1, this.enterPulse) * 0.85
      // Soft flash only at dive onset; origin stays cream arcade flash
      if (this.phase === 'origin' || this.phase === 'storyEnd') {
        ctx.fillStyle = a > 0.55 ? '#f4f4f0' : '#e8e0c8'
        ctx.globalAlpha = a * 0.35
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      } else if (this.phase === 'dive') {
        ctx.fillStyle = `rgba(160, 220, 255, ${a * 0.22})`
        ctx.fillRect(0, 0, w, h)
      } else {
        ctx.fillStyle = `rgba(255, 245, 220, ${a * 0.55})`
        ctx.fillRect(0, 0, w, h)
      }
    }

    ctx.restore()
    this.crt.present()
  }

  private advancePhase(dt: number): void {
    this.phaseT += dt

    if (this.phase === 'bang') {
      const u = Math.min(1, this.phaseT / this.bangDuration)
      this.progress = u * 0.02
      this.callbacks.onProgress?.(this.progress, 'big bang')
      if (this.phaseT >= this.bangDuration) {
        this.phase = 'eye'
        this.phaseT = 0
        this.idle = true
        this.playing = false
        this.emitBang(0)
        this.maybeEyeReady()
        this.callbacks.onProgress?.(0.03, 'creative cosmos')
      }
      return
    }

    if (this.phase === 'dive') {
      const u = Math.min(1, this.phaseT / this.diveDuration)
      this.progress = EYE.holdEnd + u * (EYE.diveEnd - EYE.holdEnd)
      const label = u < DIVE_EYE_END ? 'into the eye' : 'hyperspace'
      this.callbacks.onProgress?.(this.progress, label)
      if (this.phaseT >= this.diveDuration) {
        this.phase = 'origin'
        this.phaseT = 0
        this.origin.reset()
        this.callbacks.onOriginBegin?.()
        this.callbacks.onProgress?.(0.02, 'sleeper')
      }
      return
    }

    if (this.phase === 'origin') {
      const narr = this.callbacks.getNarrationVisual?.()
      const timeLocal = Math.min(STORY_HOLD_LOCAL, this.phaseT / this.originDuration)
      const localT = narr
        ? Math.min(1, Math.max(timeLocal * 0.15, narr.localT))
        : timeLocal
      this.progress = localT * ORIGIN.bloomEnd
      const label = labelForProgress(Math.max(0.08, this.progress))
      if (label !== this.lastLabel) {
        this.lastLabel = label
        this.callbacks.onProgress?.(this.progress, label)
      } else {
        this.callbacks.onProgress?.(this.progress, label)
      }
      // Reach last readable frame when VO is done (or time fallback).
      const voDone =
        this.callbacks.shouldHoldForNarration != null
          ? !this.callbacks.shouldHoldForNarration()
          : this.phaseT >= this.originDuration * STORY_HOLD_LOCAL
      const atHold = localT >= STORY_HOLD_LOCAL * 0.98
      if (atHold && (voDone || this.phaseT >= this.originDuration * 1.35)) {
        this.phaseT = this.originDuration * STORY_HOLD_LOCAL
        this.phase = 'storyEnd'
        this.emitAum(0)
        this.callbacks.onProgress?.(ORIGIN.bloomEnd, 'end')
        this.callbacks.onStoryEnd?.()
      }
      return
    }

    if (this.phase === 'storyEnd') {
      // Visual hold uses STORY_HOLD_LOCAL; report bloomEnd so trailing VO cues enqueue.
      this.phaseT = this.originDuration * STORY_HOLD_LOCAL
      this.progress = ORIGIN.bloomEnd
      this.callbacks.onProgress?.(this.progress, 'end')
      // Stay until Enter Site / Rewind / Skip — VO may still drain.
      void this.callbacks.shouldHoldForNarration?.()
      return
    }

    if (this.phase === 'settle') {
      this.progress = ORIGIN.bloomEnd + Math.min(1, this.phaseT / this.settleDuration) * 0.04
      this.maybeRevealSite()
      if (this.phaseT >= this.settleDuration) {
        this.canvasFade = 0
        this.maybeComplete()
      }
      return
    }

    if (this.phase === 'journey') {
      this.progress = Math.min(1, this.progress + dt / this.journeyDuration)
      this.roadBegun = true
      const label = labelForProgress(this.progress)
      if (label !== this.lastLabel) {
        this.lastLabel = label
      }
      this.callbacks.onProgress?.(this.progress, label)
    }
  }
}
