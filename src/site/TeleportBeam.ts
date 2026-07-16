/**
 * Star Trek–homage transporter: ceiling emitter casts a vertical shimmer
 * column downward onto the stage — dematerialize → rematerialize.
 */

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  hue: number
}

export class TeleportBeam {
  private root: HTMLElement
  private stage: HTMLElement | null
  private canvas: HTMLCanvasElement | null
  private ctx: CanvasRenderingContext2D | null
  private emitterEl: HTMLElement | null
  private columnEl: HTMLElement | null
  private floorEl: HTMLElement | null
  private particles: Particle[] = []
  private raf = 0
  private phase: 'idle' | 'out' | 'in' = 'idle'
  private t0 = 0
  private reducedMotion = false
  private onMid: (() => void) | null = null
  private onDone: (() => void) | null = null
  private midFired = false
  /** Ceiling emitter X in CSS pixels — aligned to the clicked tab. */
  private originX = 0

  constructor(root: HTMLElement) {
    this.root = root
    this.stage = root.querySelector('#teleport-stage')
    this.canvas = root.querySelector('#teleport-canvas')
    this.ctx = this.canvas?.getContext('2d') ?? null
    this.emitterEl = root.querySelector('.teleport-emitter')
    this.columnEl = root.querySelector('.teleport-column')
    this.floorEl = root.querySelector('.teleport-floor')
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.originX = window.innerWidth * 0.5
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  /**
   * Run full transport. `onMid` fires when dematerialize completes (swap chamber).
   * `onDone` when rematerialize finishes.
   * `originX` — CSS-pixel X of the clicked tab (beam casts from that ceiling point).
   */
  play(onMid: () => void, onDone: () => void, originX?: number): void {
    if (this.reducedMotion) {
      onMid()
      onDone()
      return
    }

    this.onMid = onMid
    this.onDone = onDone
    this.midFired = false
    this.particles = []
    this.phase = 'out'
    this.t0 = performance.now()
    this.originX =
      typeof originX === 'number' && Number.isFinite(originX)
        ? originX
        : window.innerWidth * 0.5
    this.applyOriginCss(this.originX)
    this.root.classList.add('teleporting', 'teleport-out')
    this.root.classList.remove('teleport-in')
    this.stage?.classList.add('active')
    this.stage?.setAttribute('aria-hidden', 'false')
    this.seedBurst(0.55)
    this.loop()
  }

  /** Align CSS emitter / column / floor to the tab X (canvas draws the same). */
  private applyOriginCss(x: number): void {
    const left = `${x}px`
    if (this.emitterEl) this.emitterEl.style.left = left
    if (this.columnEl) this.columnEl.style.left = left
    if (this.floorEl) this.floorEl.style.left = left
  }

  private resize(): void {
    const canvas = this.canvas
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private loop = (): void => {
    if (this.phase === 'idle') {
      this.raf = 0
      return
    }
    const now = performance.now()
    const elapsed = now - this.t0
    this.draw(elapsed)
    this.raf = requestAnimationFrame(this.loop)

    if (this.phase === 'out' && elapsed >= 380 && !this.midFired) {
      this.midFired = true
      this.onMid?.()
      this.phase = 'in'
      this.t0 = now
      this.root.classList.remove('teleport-out')
      this.root.classList.add('teleport-in')
      this.seedBurst(0.85)
    }

    if (this.phase === 'in' && elapsed >= 720) {
      this.finish()
    }
  }

  private finish(): void {
    this.phase = 'idle'
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
    this.root.classList.remove('teleporting', 'teleport-out', 'teleport-in')
    this.stage?.classList.remove('active')
    this.stage?.setAttribute('aria-hidden', 'true')
    this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.particles = []
    this.onDone?.()
    this.onMid = null
    this.onDone = null
  }

  private seedBurst(intensity: number): void {
    const h = window.innerHeight
    const cx = this.originX
    const count = Math.floor(70 * intensity + 40)
    for (let i = 0; i < count; i++) {
      const spread = 28 + Math.random() * 55
      // Cast from ceiling emitter downward onto the stage
      this.particles.push({
        x: cx + (Math.random() - 0.5) * spread * 2,
        y: h * (0.06 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1.4 + Math.random() * 3.8,
        life: 0,
        max: 0.45 + Math.random() * 0.7,
        r: 0.8 + Math.random() * 2.4,
        hue: Math.random() < 0.35 ? 190 : Math.random() < 0.6 ? 55 : 160,
      })
    }
  }

  private draw(elapsed: number): void {
    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    ctx.clearRect(0, 0, w, h)

    const cx = this.originX
    const progress =
      this.phase === 'out'
        ? Math.min(1, elapsed / 380)
        : Math.min(1, elapsed / 720)

    // Vertical reach: beam grows downward from the ceiling during cast-in,
    // holds full height while dematerializing.
    const reach =
      this.phase === 'out'
        ? 0.55 + progress * 0.45
        : Math.min(1, 0.35 + progress * 1.1)
    const beamBottom = h * Math.min(0.92, 0.12 + reach * 0.8)
    const emitterY = h * 0.06

    // Vertical beam column — bright at emitter, fading toward the pad
    const beamW = 72 + Math.sin(elapsed * 0.02) * 10 + progress * 30
    const beamAlpha =
      this.phase === 'out'
        ? 0.15 + progress * 0.55
        : 0.7 * (1 - progress * 0.85)

    const col = ctx.createLinearGradient(cx - beamW, 0, cx + beamW, 0)
    col.addColorStop(0, 'transparent')
    col.addColorStop(0.35, `rgba(120, 220, 255, ${beamAlpha * 0.35})`)
    col.addColorStop(0.5, `rgba(230, 250, 255, ${beamAlpha})`)
    col.addColorStop(0.65, `rgba(160, 255, 210, ${beamAlpha * 0.4})`)
    col.addColorStop(1, 'transparent')
    ctx.fillStyle = col
    ctx.fillRect(cx - beamW, emitterY, beamW * 2, beamBottom - emitterY)

    // Falloff veil — brighter near the ceiling source
    const fall = ctx.createLinearGradient(cx, emitterY, cx, beamBottom)
    fall.addColorStop(0, `rgba(220, 250, 255, ${beamAlpha * 0.55})`)
    fall.addColorStop(0.28, `rgba(140, 220, 255, ${beamAlpha * 0.22})`)
    fall.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = fall
    ctx.fillRect(cx - beamW * 0.55, emitterY, beamW * 1.1, beamBottom - emitterY)

    // Scan bands — sweep top → bottom with the cast
    const bandCount = 18
    const bandSpan = beamBottom - emitterY
    for (let i = 0; i < bandCount; i++) {
      const y =
        emitterY +
        (((i / bandCount) * bandSpan + elapsed * 0.55) % bandSpan)
      const a = beamAlpha * (0.08 + 0.12 * Math.sin(elapsed * 0.04 + i))
      ctx.fillStyle = `rgba(200, 240, 255, ${a})`
      ctx.fillRect(cx - beamW * 0.85, y, beamW * 1.7, 2 + (i % 3))
    }

    // Edge sparkle curtains (drift downward along beam edges)
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 12; i++) {
        const y =
          emitterY +
          ((elapsed * 0.85 + i * (bandSpan / 12)) % bandSpan)
        const x = cx + side * (beamW * 0.55 + Math.sin(elapsed * 0.03 + i) * 8)
        ctx.beginPath()
        ctx.arc(x, y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 220, ${beamAlpha * 0.7})`
        ctx.fill()
      }
    }

    // Ceiling emitter aperture
    const emitR = 28 + progress * 36
    ctx.beginPath()
    ctx.ellipse(cx, emitterY, emitR, emitR * 0.28, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(200, 245, 255, ${beamAlpha})`
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, emitterY, emitR * 0.55, emitR * 0.16, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(230, 250, 255, ${beamAlpha * 0.45})`
    ctx.fill()

    // Floor pad — beam terminus
    const ringY = Math.min(h * 0.82, beamBottom)
    const ringR = 40 + progress * 50
    ctx.beginPath()
    ctx.ellipse(cx, ringY, ringR, ringR * 0.22, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(160, 230, 255, ${beamAlpha * 0.9})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, ringY, ringR * 0.6, ringR * 0.13, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 250, 200, ${beamAlpha * 0.5})`
    ctx.stroke()

    // Particles falling with the cast
    const stillAlive: Particle[] = []
    for (const p of this.particles) {
      p.life += 0.016
      p.x += p.vx
      p.y += p.vy
      p.vy *= 1.01
      if (p.life >= p.max || p.y > beamBottom + 20) continue
      const fade = 1 - p.life / p.max
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * fade, 0, Math.PI * 2)
      ctx.fillStyle =
        p.hue > 150
          ? `rgba(140, 230, 255, ${fade * 0.9})`
          : p.hue > 100
            ? `rgba(160, 255, 200, ${fade * 0.85})`
            : `rgba(255, 245, 180, ${fade})`
      ctx.fill()
      stillAlive.push(p)
    }
    this.particles = stillAlive

    // Spawn from the emitter, raining down the column
    if (Math.random() < 0.35) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * beamW,
        y: emitterY + Math.random() * 24,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 2 + Math.random() * 3.5,
        life: 0,
        max: 0.4 + Math.random() * 0.5,
        r: 1 + Math.random() * 2,
        hue: Math.random() * 200,
      })
    }
  }
}
