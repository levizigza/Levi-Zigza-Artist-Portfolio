/**
 * Cinematic iris portal — IMAX-style blues / teals / violets,
 * floating fibers, arts planets in a wide field.
 * Levi Zigza + brain Enter live in the pupil only.
 * Name reads as a holographic projection cast from the pupil.
 */

import { ArtSolarSystem } from './ArtSolarSystem'
import { FlowingBrain } from './FlowingBrain'
import { Starfield } from './Starfield'

export type EyeDrawState = {
  /** Journey progress 0–1 */
  progress: number
  time: number
  width: number
  height: number
  idle: boolean
  /** Accumulated iris paint strokes (spiral from pupil outward) */
  paintLayer?: HTMLCanvasElement | null
  /** 0–1 hyperspace dive intensity (overrides soft idle zoom) */
  hyperspace?: number
  /** Draw flowing-brain enter affordance in pupil */
  showBrain?: boolean
  brainHover?: boolean
}

/**
 * Progress windows — eye/creative-sun rematerializes after origin bloom,
 * then hyperspace yields to the cosmic path.
 */
export const EYE = {
  /** Origin bloom complete; creative iris may rise */
  holdEnd: 0.50,
  /** Name faded as hyperspace owns the dive */
  nameGone: 0.56,
  /** Dive complete — cosmic path owns the frame */
  diveEnd: 0.62,
} as const

/** Creative iris rises late — after primordial bloom; idle gate stays full eye. */
export function eyePhaseMix(progress: number, idle: boolean): number {
  if (idle) return 1
  if (progress >= EYE.diveEnd) return 0
  // Origin story owns the frame until first-light bloom
  const bloomIn = 0.40
  if (progress < bloomIn) return 0
  if (progress <= EYE.holdEnd) {
    const u = (progress - bloomIn) / (EYE.holdEnd - bloomIn)
    return u * u * (3 - 2 * u)
  }
  const t = (progress - EYE.holdEnd) / (EYE.diveEnd - EYE.holdEnd)
  return 1 - t * t
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Slow living breath / soft heartbeat for idle iris.
 * Always active on the gate (never muted incorrectly); frozen only for
 * prefers-reduced-motion. scale ~±3.2%, glow ~±16%.
 */
export function eyeBreath(timeSec = performance.now() / 1000): {
  scale: number
  glow: number
} {
  if (prefersReducedMotion()) return { scale: 1, glow: 1 }
  // ~0.48 Hz inhale/exhale (~2.1s) + softer half-period “beat”
  const breath = Math.sin(timeSec * Math.PI * 0.48)
  const beat = Math.sin(timeSec * Math.PI * 0.96)
  return {
    scale: 1 + breath * 0.032 + beat * 0.01,
    glow: 1 + breath * 0.16 + beat * 0.055,
  }
}

export function eyeZoom(
  progress: number,
  idle: boolean,
  hyperspace = 0,
  timeSec = performance.now() / 1000,
): number {
  // Enter dive: hyperspace intensity drives a hard zoom into pupil black
  if (hyperspace > 0.001) {
    const h = hyperspace * hyperspace * (3 - 2 * hyperspace)
    return 1 + h * 26
  }
  if (idle) return eyeBreath(timeSec).scale
  if (progress < 0.40) return eyeBreath(timeSec).scale
  if (progress <= EYE.holdEnd) return eyeBreath(timeSec).scale
  const t = Math.min(1, (progress - EYE.holdEnd) / (EYE.diveEnd - EYE.holdEnd))
  const e = t * t * t
  return 1 + e * 16
}

export function nameAlpha(progress: number, idle: boolean): number {
  if (idle) return 0.92 + Math.sin(performance.now() / 900) * 0.06
  // Brand lives on the gate; during journey, only a brief soft echo at bloom
  if (progress < 0.42 || progress >= EYE.nameGone) return 0
  if (progress < EYE.holdEnd) {
    const u = (progress - 0.42) / (EYE.holdEnd - 0.42)
    return u * 0.55
  }
  const t = (progress - EYE.holdEnd) / (EYE.nameGone - EYE.holdEnd)
  return 0.55 * (1 - t * t)
}

/** Pupil geometry for brain / enter hit-testing (CSS or canvas coords). */
export function pupilLayout(
  width: number,
  height: number,
  zoom = 1,
): {
  cx: number
  cy: number
  irisR: number
  pupilR: number
  brainCx: number
  brainCy: number
  brainSize: number
} {
  const { cx, cy, baseR } = eyeLayout(width, height)
  const irisR = baseR * zoom
  const pupilR = irisR * 0.28
  return {
    cx,
    cy,
    irisR,
    pupilR,
    brainCx: cx,
    brainCy: cy + pupilR * 0.42,
    brainSize: pupilR * 0.38,
  }
}

/**
 * Opening stays full-color (no phosphor CRT wash).
 * Kept as a hook so composite always runs identity/passthrough.
 */
export function eyeCrtGrade(_progress: number, _idle: boolean): number {
  return 0
}

/**
 * Dominating iris — diameter ~78% of the shorter side.
 * Planets still clear the wide field around / past the rim.
 */
export function eyeLayout(width: number, height: number): {
  cx: number
  cy: number
  baseR: number
} {
  return {
    cx: width * 0.5,
    cy: height * 0.46,
    baseR: Math.min(width, height) * 0.39,
  }
}

type Fiber = {
  angle: number
  length: number
  width: number
  hue: number
  sat: number
  lit: number
  wobble: number
  layer: number
  drift: number
  driftSpeed: number
}

type Ember = {
  angle: number
  radius: number
  size: number
  hue: number
  speed: number
  phase: number
  life: number
}

type Asteroid = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  size: number
  facets: number
  life: number
  maxLife: number
  streak: boolean
  /** Optional poetic label (e.g. mental block) */
  label?: string
}

type CosmicBloom = {
  x: number
  y: number
  age: number
  duration: number
  hue: number
  scale: number
}

export class EyePortal {
  private fibers: Fiber[] = []
  private embers: Ember[] = []
  private asteroids: Asteroid[] = []
  private bloom: CosmicBloom | null = null
  private nextAsteroidAt = 2.5 + Math.random() * 4
  /** First distant nova after a short wait; later ones stay rare */
  private nextBloomAt = 18 + Math.random() * 28
  private cosmosLastTime = -1
  private seeded = false
  private brain = new FlowingBrain()
  private solar = new ArtSolarSystem()
  private starfield = new Starfield()
  private mentalBlockSpawned = false

  getBrain(): FlowingBrain {
    return this.brain
  }

  /** Peak arts-planet flyby intensity this frame (0 if none). */
  getFlybyIntensity(): number {
    return this.solar.getFlybyIntensity()
  }

  /** True once when a cinematic planet flyby begins. */
  consumeFlybyWhoosh(): boolean {
    return this.solar.consumeFlybyWhoosh()
  }

  /**
   * Eye / creative-sun heat presence 0–1 — strongest on the idle gate,
   * fades as hyperspace zoom eats the iris.
   */
  getSunHeatPresence(progress: number, idle: boolean, hyperspace = 0): number {
    const mix = eyePhaseMix(progress, idle)
    if (mix < 0.05) return 0
    const zoom = eyeZoom(progress, idle, hyperspace, 0)
    const zoomFade = Math.max(0, 1 - Math.max(0, zoom - 1) * 0.55)
    const hsFade = Math.max(0, 1 - hyperspace * 1.4)
    return Math.max(0, Math.min(1, mix * zoomFade * hsFade * 0.92))
  }

  private seed(): void {
    if (this.seeded) return
    this.seeded = true
    const count = 920
    for (let i = 0; i < count; i++) {
      const layer = i < 280 ? 0 : i < 600 ? 1 : 2
      // IMAX iris — deep indigo, electric teal, violet; sparse warm flecks
      const roll = Math.random()
      let hue: number
      if (roll < 0.34) hue = 188 + Math.random() * 28 // teal–cyan
      else if (roll < 0.62) hue = 210 + Math.random() * 28 // electric blue
      else if (roll < 0.84) hue = 255 + Math.random() * 35 // violet–indigo
      else if (roll < 0.94) hue = 165 + Math.random() * 18 // aqua rim
      else hue = 28 + Math.random() * 18 // sparse warm fleck

      this.fibers.push({
        angle: Math.random() * Math.PI * 2,
        length: 0.32 + Math.random() * 0.65 + layer * 0.04,
        width: 0.5 + Math.random() * (layer === 0 ? 2.2 : 1.35),
        hue,
        sat: 62 + Math.random() * 34,
        lit: 28 + Math.random() * 46 + (layer === 0 ? 8 : 0),
        wobble: (Math.random() - 0.5) * 0.4,
        layer,
        drift: (Math.random() - 0.5) * 0.6,
        driftSpeed: 0.08 + Math.random() * 0.22,
      })
    }

    for (let i = 0; i < 120; i++) {
      this.embers.push({
        angle: Math.random() * Math.PI * 2,
        radius: 0.35 + Math.random() * 0.75,
        size: 1.1 + Math.random() * 3.2,
        hue: Math.random() > 0.7 ? 200 + Math.random() * 40 : 260 + Math.random() * 35,
        speed: 0.12 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        life: Math.random(),
      })
    }
  }

  /**
   * Returns remaining eye overlay alpha (0 = fully in world).
   * Caller draws labyrinth underneath; eye paints on top.
   */
  draw(ctx: CanvasRenderingContext2D, s: EyeDrawState): number {
    const mix = eyePhaseMix(s.progress, s.idle)
    if (mix <= 0.001) return 0

    this.seed()
    const { width: w, height: h, time } = s
    const hs = s.hyperspace ?? 0
    // Idle / hold breath always drives zoom + glow so the iris never goes static
    const breath = s.idle || s.progress <= EYE.holdEnd ? eyeBreath(time) : { scale: 1, glow: 1 }
    const zoom = eyeZoom(s.progress, s.idle, hs, time)
    const { cx, cy, baseR } = eyeLayout(w, h)
    const irisR = baseR * zoom
    const pupilR = irisR * 0.28
    const limbusR = irisR * 0.96
    const glow = breath.glow

    const dt = this.cosmosLastTime < 0 ? 1 / 60 : Math.min(0.05, Math.max(0, time - this.cosmosLastTime))
    this.cosmosLastTime = time
    // Spawn atmosphere only while idling; always advance in-flight rocks / blooms
    this.tickCosmos(w, h, cx, cy, irisR, time, dt, s.idle && zoom < 1.5)

    ctx.save()
    ctx.globalAlpha = mix

    // Wide void — soft depth, not a hard sun disc frame
    const frame = ctx.createRadialGradient(cx, cy, irisR * 0.5, cx, cy, Math.max(w, h) * 0.92)
    frame.addColorStop(0, 'rgba(0,0,0,0)')
    frame.addColorStop(0.28, 'rgba(4, 8, 22, 0.2)')
    frame.addColorStop(0.58, 'rgba(2, 5, 14, 0.85)')
    frame.addColorStop(1, '#010104')
    ctx.fillStyle = frame
    ctx.fillRect(0, 0, w, h)

    // Deep bg: nova, then starfield in the black void around the iris (masked off the eye)
    this.drawCosmicBloom(ctx, w, h, time)
    this.starfield.draw(ctx, w, h, cx, cy, irisR, time)
    this.drawAsteroids(ctx, irisR, cx, cy)

    const solarAlpha = mix * Math.max(0, 1 - (zoom - 1) * 0.45)
    const solarState = {
      time,
      cx,
      cy,
      sunR: baseR, // orbits stay world-stable; breathing doesn't yank planets
      alpha: solarAlpha,
      zoom,
      viewW: w,
      viewH: h,
    }

    // Far-side planets + orbit traces behind the iris
    if (zoom < 3.2 && solarAlpha > 0.02) {
      this.solar.draw(ctx, solarState, 'behind')
    }

    // Skip soft bloom once hyperspace dive begins (warp owns the look)
    if (hs < 0.08) {
      this.drawSoftBloom(ctx, cx, cy, irisR, time, zoom, glow)
    }

    // Soft dark disc under the iris body
    const disc = ctx.createRadialGradient(cx, cy, pupilR, cx, cy, irisR * 1.08)
    disc.addColorStop(0, '#060812')
    disc.addColorStop(0.55, '#04060e')
    disc.addColorStop(1, '#010208')
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(cx, cy, irisR * 1.04, 0, Math.PI * 2)
    ctx.fill()

    // Iris underpaint — cool IMAX wash (teal core → indigo limbus)
    const under = ctx.createRadialGradient(cx, cy, pupilR * 0.85, cx, cy, limbusR)
    under.addColorStop(0, '#1a3a5c')
    under.addColorStop(0.18, '#0e6a8a')
    under.addColorStop(0.38, '#1a4fd0')
    under.addColorStop(0.58, '#4a28a8')
    under.addColorStop(0.78, '#0a1a4a')
    under.addColorStop(1, '#04060e')
    ctx.fillStyle = under
    ctx.beginPath()
    ctx.arc(cx, cy, limbusR, 0, Math.PI * 2)
    ctx.fill()

    // Radial fibers + spiral iris paint (clipped to iris)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, limbusR, 0, Math.PI * 2)
    ctx.clip()

    for (const f of this.fibers) {
      const ang =
        f.angle +
        f.wobble * 0.12 +
        Math.sin(time * (0.55 + f.layer * 0.12) + f.angle * 2.5) * 0.018 +
        Math.sin(time * f.driftSpeed + f.drift * 4) * 0.06 +
        time * f.driftSpeed * 0.035 * Math.sign(f.drift || 1)
      const breath = Math.sin(time * (0.7 + f.layer * 0.15) + f.angle * 3) * 0.014
      const inner = pupilR * (1.02 + f.layer * 0.02 + breath)
      const outer = pupilR + (limbusR - pupilR) * f.length
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      const x0 = cx + cos * inner
      const y0 = cy + sin * inner
      const mid = (inner + outer) * 0.5
      const bend = f.wobble * irisR * 0.045
      const shimmer = Math.sin(time * 2.4 + f.angle * 7) * irisR * 0.008
      const xm = cx + Math.cos(ang + bend * 0.02) * mid + cos * shimmer * 0.3
      const ym = cy + Math.sin(ang + bend * 0.02) * mid + sin * shimmer
      const x1 = cx + cos * outer
      const y1 = cy + sin * outer

      const litPulse = f.lit * glow + Math.sin(time * 1.4 + f.angle * 5) * 6
      ctx.strokeStyle = `hsla(${f.hue}, ${f.sat}%, ${Math.max(14, Math.min(74, litPulse))}%, ${0.34 + f.layer * 0.14})`
      ctx.lineWidth = f.width * (zoom > 2 ? 1 + (zoom - 2) * 0.08 : 1)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.quadraticCurveTo(xm, ym, x1, y1)
      ctx.stroke()
    }

    this.drawEmbers(ctx, cx, cy, pupilR, limbusR, time, zoom)

    if (s.paintLayer && s.paintLayer.width > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.88
      ctx.drawImage(s.paintLayer, 0, 0)
      ctx.restore()
    }

    // Collarette — cool teal ring near pupil (continuous breath luminosity)
    ctx.globalCompositeOperation = 'screen'
    const corePulse = (0.52 + Math.sin(time * 1.8) * 0.14) * Math.max(0.85, glow)
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2 + time * 0.06
      const inner = pupilR * 1.02
      const outer = pupilR * (1.5 + (i % 4) * 0.08) + Math.sin(time * 3 + i) * irisR * 0.008
      ctx.strokeStyle = `hsla(${195 + (i % 5) * 14}, 80%, 65%, ${0.085 * corePulse})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
      ctx.stroke()
    }
    const collar = ctx.createRadialGradient(cx, cy, pupilR * 0.9, cx, cy, pupilR * 1.55)
    collar.addColorStop(0, `rgba(120, 210, 255, ${0.32 * corePulse})`)
    collar.addColorStop(0.4, `rgba(80, 140, 255, ${0.2 * corePulse})`)
    collar.addColorStop(0.7, `rgba(140, 80, 220, ${0.16 * corePulse})`)
    collar.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = collar
    ctx.beginPath()
    ctx.arc(cx, cy, pupilR * 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    ctx.restore() // clip

    // Limbus — soft dark rim (not fire)
    const limbus = ctx.createRadialGradient(cx, cy, irisR * 0.68, cx, cy, irisR * 1.02)
    limbus.addColorStop(0, 'rgba(0,0,0,0)')
    limbus.addColorStop(0.7, 'rgba(4, 8, 24, 0.25)')
    limbus.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.fillStyle = limbus
    ctx.beginPath()
    ctx.arc(cx, cy, irisR * 1.02, 0, Math.PI * 2)
    ctx.fill()

    // Soft outer rim edge
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = `hsla(${205 + Math.sin(time) * 10}, 70%, 62%, ${0.22 + Math.sin(time * 2) * 0.05})`
    ctx.lineWidth = Math.max(1.5, irisR * 0.012)
    ctx.beginPath()
    ctx.arc(cx, cy, irisR * 0.988, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Pupil — pure void (portal)
    const pupilGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pupilR)
    pupilGrad.addColorStop(0, '#000000')
    pupilGrad.addColorStop(0.7, '#010104')
    pupilGrad.addColorStop(1, '#0a0818')
    ctx.fillStyle = pupilGrad
    ctx.beginPath()
    ctx.arc(cx, cy, pupilR, 0, Math.PI * 2)
    ctx.fill()

    // Soft catch-light
    ctx.fillStyle = 'rgba(180, 210, 255, 0.14)'
    ctx.beginPath()
    ctx.ellipse(
      cx - pupilR * 0.32,
      cy - pupilR * 0.38,
      pupilR * 0.24,
      pupilR * 0.12,
      -0.5,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    // Near-side planets in front of the iris
    if (zoom < 3.2 && solarAlpha > 0.02) {
      this.solar.draw(ctx, solarState, 'front')
    }

    // Levi Zigza — holographic projection cast from the pupil
    const na = nameAlpha(s.progress, s.idle) * mix
    if (na > 0.01) {
      this.drawLogo(ctx, cx, cy, pupilR, irisR, na, w, time)
    }

    // Flowing brain enter affordance — black pupil space below the name
    if (s.showBrain && s.idle && na > 0.2) {
      const reducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      this.brain.draw(ctx, {
        time,
        cx,
        cy: cy + pupilR * 0.42,
        size: pupilR * 0.38,
        alpha: na * mix * 0.95,
        hover: s.brainHover,
        reducedMotion,
      })
    }

    ctx.restore()
    return mix
  }

  private tickCosmos(
    w: number,
    h: number,
    cx: number,
    cy: number,
    irisR: number,
    time: number,
    dt: number,
    allowSpawn: boolean,
  ): void {
    if (prefersReducedMotion()) return

    // Sparse asteroids — keep at most 3 alive
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i]!
      a.x += a.vx * dt
      a.y += a.vy * dt
      a.rot += a.spin * dt
      a.life += dt
      if (
        a.life > a.maxLife ||
        a.x < -80 ||
        a.x > w + 80 ||
        a.y < -80 ||
        a.y > h + 80
      ) {
        this.asteroids.splice(i, 1)
      }
    }

    if (allowSpawn && this.asteroids.length < 3 && time >= this.nextAsteroidAt) {
      const labeled = !this.mentalBlockSpawned && Math.random() < 0.55
      this.spawnAsteroid(w, h, cx, cy, irisR, labeled)
      if (labeled) this.mentalBlockSpawned = true
      this.nextAsteroidAt = time + 4.5 + Math.random() * 9
    }

    // Rare distant birth / supernova — deep background, idle only
    if (this.bloom) {
      this.bloom.age += dt
      if (this.bloom.age >= this.bloom.duration) {
        this.bloom = null
        this.nextBloomAt = time + 70 + Math.random() * 110
      }
    } else if (allowSpawn && time >= this.nextBloomAt) {
      this.spawnBloom(w, h, cx, cy, irisR)
    }
  }

  private spawnAsteroid(
    w: number,
    h: number,
    cx: number,
    cy: number,
    irisR: number,
    mentalBlock = false,
  ): void {
    const streak = mentalBlock ? false : Math.random() < 0.35
    const edge = Math.floor(Math.random() * 4)
    let x = 0
    let y = 0
    if (edge === 0) {
      x = Math.random() * w
      y = -20
    } else if (edge === 1) {
      x = w + 20
      y = Math.random() * h
    } else if (edge === 2) {
      x = Math.random() * w
      y = h + 20
    } else {
      x = -20
      y = Math.random() * h
    }

    // Aim loosely across the field, avoiding the iris core
    const tx = cx + (Math.random() - 0.5) * irisR * 3.2
    const ty = cy + (Math.random() - 0.5) * irisR * 2.6
    const dx = tx - x
    const dy = ty - y
    const dist = Math.hypot(dx, dy) || 1
    const speed = streak ? 140 + Math.random() * 180 : 28 + Math.random() * 55

    this.asteroids.push({
      x,
      y,
      vx: (dx / dist) * speed + (Math.random() - 0.5) * 18,
      vy: (dy / dist) * speed + (Math.random() - 0.5) * 18,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (streak ? 1.2 : 2.8),
      size: mentalBlock
        ? 5.5 + Math.random() * 3
        : streak
          ? 1.2 + Math.random() * 2.2
          : 2.5 + Math.random() * 5.5,
      facets: 5 + Math.floor(Math.random() * 4),
      life: 0,
      maxLife: streak ? 1.8 + Math.random() * 1.4 : 5 + Math.random() * 6,
      streak,
      label: mentalBlock ? 'mental block' : undefined,
    })
  }

  private spawnBloom(w: number, h: number, cx: number, cy: number, irisR: number): void {
    // Place in deep void corners/edges. Keep out only the iris body —
    // the old irisR²×4.5 exclusion was larger than the screen, so blooms never spawned.
    const m = Math.min(w, h) * 0.05
    const bandX = w * 0.28
    const bandY = h * 0.28
    const candidates = [
      { x: m + Math.random() * bandX, y: m + Math.random() * bandY },
      { x: w - m - Math.random() * bandX, y: m + Math.random() * bandY },
      { x: m + Math.random() * bandX, y: h - m - Math.random() * bandY },
      { x: w - m - Math.random() * bandX, y: h - m - Math.random() * bandY },
      { x: m + Math.random() * (w * 0.18), y: h * (0.28 + Math.random() * 0.44) },
      { x: w - m - Math.random() * (w * 0.18), y: h * (0.28 + Math.random() * 0.44) },
    ]
    // Fisher–Yates shuffle so corners stay equally likely
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = candidates[i]!
      candidates[i] = candidates[j]!
      candidates[j] = tmp
    }

    const minDist = irisR * 1.22
    const minDist2 = minDist * minDist
    for (const c of candidates) {
      const dx = c.x - cx
      const dy = c.y - cy
      if (dx * dx + dy * dy < minDist2) continue
      const roll = Math.random()
      const hue =
        roll < 0.4
          ? 200 + Math.random() * 40
          : roll < 0.7
            ? 280 + Math.random() * 40
            : 30 + Math.random() * 40
      this.bloom = {
        x: c.x,
        y: c.y,
        age: 0,
        duration: 5 + Math.random() * 3.5,
        hue,
        // Compact distant bloom — reads as far behind the iris
        scale: 0.38 + Math.random() * 0.42,
      }
      return
    }
    // Corner kept out this frame — try again soon
    this.nextBloomAt = performance.now() / 1000 + 12 + Math.random() * 18
  }

  private drawAsteroids(
    ctx: CanvasRenderingContext2D,
    irisR: number,
    cx: number,
    cy: number,
  ): void {
    if (!this.asteroids.length) return
    ctx.save()
    for (const a of this.asteroids) {
      const fadeIn = Math.min(1, a.life * 2.2)
      const fadeOut = Math.min(1, (a.maxLife - a.life) * 1.4)
      const alpha = Math.min(fadeIn, fadeOut) * 0.72
      if (alpha < 0.02) continue

      // Soft occlusion near iris body
      const dx = a.x - cx
      const dy = a.y - cy
      const nearIris = dx * dx + dy * dy < irisR * irisR * 1.15
      if (nearIris) continue

      ctx.globalAlpha = alpha

      if (a.streak) {
        const len = Math.hypot(a.vx, a.vy) || 1
        const nx = a.vx / len
        const ny = a.vy / len
        const trail = 18 + a.size * 10
        const g = ctx.createLinearGradient(
          a.x - nx * trail,
          a.y - ny * trail,
          a.x + nx * a.size,
          a.y + ny * a.size,
        )
        g.addColorStop(0, 'rgba(180, 200, 230, 0)')
        g.addColorStop(0.55, 'rgba(200, 215, 240, 0.35)')
        g.addColorStop(1, 'rgba(240, 245, 255, 0.85)')
        ctx.strokeStyle = g
        ctx.lineWidth = Math.max(1, a.size * 0.55)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(a.x - nx * trail, a.y - ny * trail)
        ctx.lineTo(a.x, a.y)
        ctx.stroke()
        ctx.fillStyle = 'rgba(230, 235, 250, 0.9)'
        ctx.beginPath()
        ctx.arc(a.x, a.y, a.size * 0.45, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.save()
        ctx.translate(a.x, a.y)
        ctx.rotate(a.rot)
        ctx.fillStyle = 'rgba(90, 82, 78, 0.85)'
        ctx.strokeStyle = 'rgba(160, 150, 140, 0.35)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        for (let i = 0; i < a.facets; i++) {
          const ang = (i / a.facets) * Math.PI * 2
          const rad = a.size * (0.7 + ((i * 37) % 10) * 0.04)
          const px = Math.cos(ang) * rad
          const py = Math.sin(ang) * rad
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        // Tiny highlight facet
        ctx.fillStyle = 'rgba(200, 190, 175, 0.28)'
        ctx.beginPath()
        ctx.arc(-a.size * 0.25, -a.size * 0.2, a.size * 0.28, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        if (a.label) {
          ctx.save()
          ctx.globalAlpha = alpha * 0.85
          ctx.font = `500 ${Math.max(9, Math.min(12, a.size * 1.35))}px Fraunces, serif`
          ctx.fillStyle = 'rgba(220, 200, 170, 0.75)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(a.label, a.x, a.y + a.size + 4)
          ctx.restore()
        }
      }
    }
    ctx.restore()
  }

  /** Distant universe-birth bloom — deep background, never a foreground flash */
  private drawCosmicBloom(
    ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    _time: number,
  ): void {
    if (!this.bloom) return
    const b = this.bloom
    const u = b.age / b.duration
    // Soft birth → hold → long fade
    let envelope: number
    if (u < 0.14) envelope = this.smooth01(u / 0.14)
    else if (u < 0.38) envelope = 1
    else envelope = 1 - this.smooth01((u - 0.38) / 0.62)
    if (envelope < 0.01) return

    const R = Math.min(_w, _h) * 0.2 * b.scale
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = envelope * 0.78

    // Outer soft nebula (far field)
    const nebula = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 2.6)
    nebula.addColorStop(0, `hsla(${b.hue}, 68%, 68%, 0.42)`)
    nebula.addColorStop(0.22, `hsla(${b.hue + 25}, 52%, 52%, 0.2)`)
    nebula.addColorStop(0.55, `hsla(${b.hue - 20}, 38%, 38%, 0.07)`)
    nebula.addColorStop(1, 'hsla(0,0%,0%,0)')
    ctx.fillStyle = nebula
    ctx.beginPath()
    ctx.arc(b.x, b.y, R * 2.6, 0, Math.PI * 2)
    ctx.fill()

    // Bright core
    const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 0.5)
    core.addColorStop(0, `hsla(${b.hue + 10}, 40%, 95%, ${0.75 * envelope})`)
    core.addColorStop(0.35, `hsla(${b.hue}, 65%, 72%, ${0.38 * envelope})`)
    core.addColorStop(1, 'hsla(0,0%,0%,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(b.x, b.y, R * 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Soft cross — distant nova, low presence
    if (envelope > 0.22) {
      ctx.globalAlpha = envelope * 0.22
      ctx.strokeStyle = `hsla(${b.hue}, 48%, 86%, 1)`
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(b.x - R * 1.45, b.y)
      ctx.lineTo(b.x + R * 1.45, b.y)
      ctx.moveTo(b.x, b.y - R * 1.2)
      ctx.lineTo(b.x, b.y + R * 1.2)
      ctx.stroke()
    }

    ctx.restore()
  }

  private smooth01(t: number): number {
    const x = Math.max(0, Math.min(1, t))
    return x * x * (3 - 2 * x)
  }

  /** Subtle cool bloom — not solar corona / fire tongues */
  private drawSoftBloom(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    irisR: number,
    time: number,
    zoom: number,
    glow = 1,
  ): void {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    // Continuous iris pulse — glow from eyeBreath never gated off while idle
    const pulse = (0.82 + Math.sin(time * 0.9) * 0.12) * Math.max(0.85, glow)
    for (let ring = 0; ring < 3; ring++) {
      const r0 = irisR * (1.0 + ring * 0.06)
      const r1 = irisR * (1.18 + ring * 0.2)
      const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1)
      const a = (0.16 - ring * 0.034) * pulse * (1 / Math.max(1, zoom * 0.9))
      g.addColorStop(0, `rgba(80, 160, 255, ${a})`)
      g.addColorStop(0.45, `rgba(100, 80, 220, ${a * 0.42})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawEmbers(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pupilR: number,
    limbusR: number,
    time: number,
    zoom: number,
  ): void {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const e of this.embers) {
      const ang = e.angle + time * e.speed * 0.35 + Math.sin(time * 0.7 + e.phase) * 0.15
      const rad =
        pupilR +
        (limbusR - pupilR) * (e.radius + Math.sin(time * 1.1 + e.phase) * 0.06)
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad
      const pulse = 0.45 + Math.sin(time * 2.2 + e.phase) * 0.3
      const sz = e.size * (0.7 + pulse * 0.45) * Math.min(1.35, zoom)
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 2.2)
      g.addColorStop(0, `hsla(${e.hue}, 85%, 72%, ${0.45 * pulse})`)
      g.addColorStop(0.4, `hsla(${e.hue + 20}, 75%, 55%, ${0.18 * pulse})`)
      g.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, sz * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /**
   * LEVI ZIGZA as light projected from the pupil/iris —
   * volumetric cones, beam filaments, scanline hologram plate.
   * Scale + glow intensity locked to eyeBreath (same iris pulse phase).
   */
  private drawLogo(
    ctx: CanvasRenderingContext2D,
    pupilCx: number,
    pupilCy: number,
    pupilR: number,
    irisR: number,
    alpha: number,
    w: number,
    time: number,
  ): void {
    const name = 'LEVI ZIGZA'
    // Slightly tighter sizing so the longer glyph run stays in-iris
    const nameSize = Math.min(irisR * 0.2, w * 0.072, 64)
    const nameCy = pupilCy - pupilR * 0.12
    const reduced = prefersReducedMotion()

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.floor(nameSize)}px "Sora", "Syne", sans-serif`

    const metrics = ctx.measureText(name)
    const textW = Math.max(metrics.width, nameSize * 6.4)
    const textH = nameSize * 1.15
    const halfW = textW * 0.52
    const halfH = textH * 0.55

    // Eye-synced pulse (same phase as iris) + tiny projector flicker
    const eyePulse = eyeBreath(time)
    const flicker = reduced ? 1 : 1 + Math.sin(time * 11.0) * 0.012
    const breath = eyePulse.glow * flicker
    const pulseScale = eyePulse.scale
    const scanPhase = reduced ? 0 : (time * 42) % (textH + 8)

    // —— Volumetric cast: light cone from pupil toward the name plate ——
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const apexX = pupilCx
    const apexY = pupilCy + pupilR * 0.08
    const coneA = 0.22 * breath * alpha

    // Soft main frustum (trapezoid pupil → plate)
    const cone = ctx.createLinearGradient(apexX, apexY, apexX, nameCy - halfH)
    cone.addColorStop(0, `rgba(180, 230, 255, ${0.55 * coneA})`)
    cone.addColorStop(0.35, `rgba(120, 190, 255, ${0.22 * coneA})`)
    cone.addColorStop(0.75, `rgba(90, 160, 255, ${0.12 * coneA})`)
    cone.addColorStop(1, `rgba(140, 200, 255, ${0.04 * coneA})`)
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(apexX - pupilR * 0.22, apexY)
    ctx.lineTo(apexX + pupilR * 0.22, apexY)
    ctx.lineTo(apexX + halfW * 1.08, nameCy + halfH * 0.85)
    ctx.lineTo(apexX - halfW * 1.08, nameCy + halfH * 0.85)
    ctx.closePath()
    ctx.fill()

    // Layered depth beams (left / center / right rays)
    const rays = [
      { t: -0.92, a: 0.35 },
      { t: -0.45, a: 0.55 },
      { t: 0, a: 0.75 },
      { t: 0.45, a: 0.55 },
      { t: 0.92, a: 0.35 },
    ]
    for (const ray of rays) {
      const tx = apexX + halfW * ray.t
      const ty = nameCy - halfH * 0.15
      const beam = ctx.createLinearGradient(apexX, apexY, tx, ty)
      beam.addColorStop(0, `rgba(220, 245, 255, ${0.5 * coneA * ray.a})`)
      beam.addColorStop(0.45, `rgba(140, 200, 255, ${0.18 * coneA * ray.a})`)
      beam.addColorStop(1, `rgba(100, 170, 255, 0)`)
      ctx.strokeStyle = beam
      ctx.lineWidth = (1.2 + Math.abs(ray.t) * 0.6) * breath
      ctx.beginPath()
      ctx.moveTo(apexX + ray.t * pupilR * 0.15, apexY)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }

    // Specular sparkles along cast
    if (!reduced) {
      for (let i = 0; i < 9; i++) {
        const u = (i + 0.5) / 9
        const wobble = Math.sin(time * 3.1 + i * 1.7) * 0.12
        const sx = apexX + halfW * (wobble + Math.sin(time * 1.4 + i) * 0.35) * u
        const sy = apexY + (nameCy - apexY) * (0.2 + u * 0.75)
        const spark = 0.08 + 0.12 * Math.max(0, Math.sin(time * 7 + i * 2.3))
        ctx.fillStyle = `rgba(210, 240, 255, ${spark * breath * alpha})`
        ctx.beginPath()
        ctx.arc(sx, sy, 0.8 + (1 - u) * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    // —— Pupil emitter — bright source the beams leave from ——
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const emit = ctx.createRadialGradient(
      apexX,
      apexY,
      0,
      apexX,
      apexY,
      pupilR * 0.55,
    )
    emit.addColorStop(0, `rgba(255, 255, 255, ${0.55 * breath * alpha})`)
    emit.addColorStop(0.25, `rgba(180, 230, 255, ${0.28 * breath * alpha})`)
    emit.addColorStop(0.65, `rgba(100, 170, 255, ${0.08 * breath * alpha})`)
    emit.addColorStop(1, 'rgba(80, 140, 255, 0)')
    ctx.fillStyle = emit
    ctx.beginPath()
    ctx.arc(apexX, apexY, pupilR * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Plate + glyphs breathe with the iris (scale about name center)
    ctx.save()
    ctx.translate(pupilCx, nameCy)
    ctx.scale(pulseScale, pulseScale)
    ctx.translate(-pupilCx, -nameCy)

    // —— Soft umbra / depth cast behind the hologram plate ——
    const shadowOx = nameSize * 0.045
    const shadowOy = nameSize * 0.11
    ctx.save()
    const umbra = ctx.createRadialGradient(
      pupilCx + shadowOx,
      nameCy + shadowOy,
      halfH * 0.15,
      pupilCx + shadowOx,
      nameCy + shadowOy,
      halfW * 1.05,
    )
    umbra.addColorStop(0, `rgba(0, 4, 18, ${0.42 * breath})`)
    umbra.addColorStop(0.4, `rgba(0, 3, 14, ${0.2 * breath})`)
    umbra.addColorStop(0.75, `rgba(0, 2, 10, ${0.07 * breath})`)
    umbra.addColorStop(1, 'rgba(0, 0, 8, 0)')
    ctx.fillStyle = umbra
    ctx.beginPath()
    ctx.ellipse(
      pupilCx + shadowOx,
      nameCy + shadowOy,
      halfW * 1.06,
      halfH * 1.4,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()

    // —— Hologram plate behind the letters ——
    ctx.save()
    const plate = ctx.createLinearGradient(
      pupilCx - halfW,
      nameCy,
      pupilCx + halfW,
      nameCy,
    )
    plate.addColorStop(0, 'rgba(60, 120, 200, 0)')
    plate.addColorStop(0.2, `rgba(80, 150, 230, ${0.08 * breath})`)
    plate.addColorStop(0.5, `rgba(140, 200, 255, ${0.14 * breath})`)
    plate.addColorStop(0.8, `rgba(80, 150, 230, ${0.08 * breath})`)
    plate.addColorStop(1, 'rgba(60, 120, 200, 0)')
    ctx.fillStyle = plate
    ctx.beginPath()
    ctx.ellipse(pupilCx, nameCy, halfW * 1.05, halfH * 1.15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // —— Dark secondary plate / glyph shadow (cinematic depth) ——
    ctx.save()
    ctx.fillStyle = `rgba(0, 4, 16, ${0.38 * breath})`
    ctx.fillText(name, pupilCx + shadowOx * 1.35, nameCy + shadowOy * 1.25)
    ctx.fillStyle = `rgba(2, 8, 22, ${0.55 * breath})`
    ctx.fillText(name, pupilCx + shadowOx * 0.7, nameCy + shadowOy * 0.75)
    ctx.restore()

    // —— Chromatic ghost offsets (projection refraction) ——
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const chroma = reduced ? 0 : 1.15 * breath
    ctx.globalAlpha = alpha * 0.28
    ctx.fillStyle = '#ff4a6a'
    ctx.fillText(name, pupilCx - chroma, nameCy)
    ctx.fillStyle = '#3ad0ff'
    ctx.fillText(name, pupilCx + chroma, nameCy)
    ctx.restore()

    // —— Core glyph with projection bloom ——
    ctx.save()
    ctx.shadowColor = `rgba(120, 200, 255, ${0.65 * breath})`
    ctx.shadowBlur = 28 * breath
    ctx.fillStyle = `rgba(230, 245, 255, ${0.55 * breath})`
    ctx.fillText(name, pupilCx, nameCy)

    ctx.shadowBlur = 12 * breath
    ctx.shadowColor = `rgba(180, 230, 255, ${0.9 * breath})`
    ctx.fillStyle = '#f7fbff'
    ctx.fillText(name, pupilCx, nameCy)

    // Hot core (emitter wash on the plate)
    ctx.shadowBlur = 0
    ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * breath})`
    ctx.fillText(name, pupilCx, nameCy)
    ctx.restore()

    // —— Scanlines etched across the hologram plate ——
    ctx.save()
    ctx.beginPath()
    ctx.rect(pupilCx - halfW * 1.05, nameCy - halfH, halfW * 2.1, textH)
    ctx.clip()

    ctx.globalCompositeOperation = 'source-atop'
    const lineStep = Math.max(2, Math.floor(nameSize * 0.09))
    for (let y = nameCy - halfH; y < nameCy + halfH; y += lineStep) {
      const band = 0.05 + 0.06 * Math.sin((y + time * 40) * 0.35)
      ctx.fillStyle = `rgba(4, 12, 28, ${band * breath})`
      ctx.fillRect(pupilCx - halfW * 1.05, y, halfW * 2.1, 1)
      ctx.fillStyle = `rgba(180, 230, 255, ${band * 0.35 * breath})`
      ctx.fillRect(pupilCx - halfW * 1.05, y + 1, halfW * 2.1, 0.5)
    }

    // Moving scan bar (projector sweep)
    if (!reduced) {
      const barY = nameCy - halfH + scanPhase
      const sweep = ctx.createLinearGradient(0, barY - 4, 0, barY + 6)
      sweep.addColorStop(0, 'rgba(160, 220, 255, 0)')
      sweep.addColorStop(0.45, `rgba(200, 240, 255, ${0.22 * breath})`)
      sweep.addColorStop(1, 'rgba(160, 220, 255, 0)')
      ctx.fillStyle = sweep
      ctx.fillRect(pupilCx - halfW * 1.05, barY - 4, halfW * 2.1, 10)
    }
    ctx.restore()

    // Soft rim light on glyph edges
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha * 0.35 * breath
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.55)'
    ctx.lineWidth = 0.75
    ctx.strokeText(name, pupilCx, nameCy)
    ctx.restore()

    ctx.restore() // end pulseScale
    ctx.restore()
  }
}
