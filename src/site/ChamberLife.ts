/**
 * Per-chamber living worlds — planetfall atmospheres + canvas motifs.
 * Echoes opening cosmography: Film/Jupiter, Music/Saturn, Writing/Mercury, Photo/Mars.
 * Pauses when tab is hidden. Honors prefers-reduced-motion.
 */

export type BeatSource = {
  getLevel: () => number
}

const SCRIPT_GLYPHS = [
  '◇', '▣', '◎', '彡', '◐', '◈', '✦', '·', '☰', '〡',
  'signal', 'wonder', 'frame', 'tone', 'ink', 'light', 'word', 'form',
  'WORLD', 'CRACK', 'SCORE', 'LINE',
]

type RainDrop = {
  x: number
  y: number
  vy: number
  glyph: string
  alpha: number
  size: number
}

type DustMote = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

type CloudBand = {
  y: number
  speed: number
  thick: number
  hue: number
  phase: number
}

export class ChamberLife {
  private root: HTMLElement
  private beat: BeatSource
  private raf = 0
  private running = false
  private page = 'home'
  private t0 = 0
  private localPhase = 0
  private reducedMotion = false

  private worldCanvas: HTMLCanvasElement | null = null
  private worldCtx: CanvasRenderingContext2D | null = null
  private sonicCanvas: HTMLCanvasElement | null = null
  private sonicCtx: CanvasRenderingContext2D | null = null
  private liturgyCol: HTMLElement | null = null
  private flashEl: HTMLElement | null = null
  private lastLiturgy = 0
  private lastFlash = 0
  private holdIndex = 0

  private rain: RainDrop[] = []
  private dust: DustMote[] = []
  private clouds: CloudBand[] = []
  private resizeBound: () => void

  constructor(root: HTMLElement, beat: BeatSource) {
    this.root = root
    this.beat = beat
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.worldCanvas = root.querySelector('#world-canvas')
    this.worldCtx = this.worldCanvas?.getContext('2d') ?? null
    this.sonicCanvas = root.querySelector('#sonic-canvas')
    this.sonicCtx = this.sonicCanvas?.getContext('2d') ?? null
    this.liturgyCol = root.querySelector('#liturgy-column')
    this.flashEl = root.querySelector('#photo-flash')

    this.resizeBound = () => this.resizeWorld()
    window.addEventListener('resize', this.resizeBound)

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause()
      else if (this.running) this.startLoop()
    })

    this.seedClouds()
    this.seedDust()
    this.resizeWorld()
  }

  setPage(id: string): void {
    this.page = id
    this.root.dataset.chamber = id
    if (id === 'scripts') {
      this.seedLiturgy()
      this.seedRain()
    }
    if (id === 'music') this.resizeSonic()
    if (id === 'photography') this.seedDust()
    if (id === 'video') this.seedClouds()
    this.resizeWorld()
  }

  /** Brief warp streak burst for planetfall transitions */
  triggerPlanetfall(): void {
    if (this.reducedMotion) return
    this.root.classList.remove('planetfalling')
    void this.root.offsetWidth
    this.root.classList.add('planetfalling')
    window.setTimeout(() => this.root.classList.remove('planetfalling'), 900)
  }

  start(): void {
    this.running = true
    this.resizeWorld()
    if (!document.hidden) this.startLoop()
  }

  stop(): void {
    this.running = false
    this.pause()
  }

  private pause(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
  }

  private startLoop(): void {
    if (this.raf) return
    this.t0 = performance.now()
    const tick = (now: number) => {
      if (!this.running || document.hidden) {
        this.raf = 0
        return
      }
      const dt = Math.min(0.05, (now - this.t0) / 1000)
      this.t0 = now
      this.localPhase += dt
      this.frame(now, dt)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  private frame(now: number, dt: number): void {
    if (this.reducedMotion) {
      this.root.style.setProperty('--beat', '0.25')
      this.root.style.setProperty('--pulse', '0.5')
      this.root.style.setProperty('--sky-shift', '0')
      return
    }

    const audio = this.beat.getLevel()
    const soft =
      0.42 + 0.58 * (0.5 + 0.5 * Math.sin(this.localPhase * Math.PI * 2 * 0.55))
    const beat = Math.max(audio, soft * 0.35 + audio * 0.65)
    const pulse = 0.5 + 0.5 * Math.sin(this.localPhase * Math.PI * 2 * 0.28)
    const skyShift = Math.sin(this.localPhase * 0.08) * 0.5 + 0.5

    this.root.style.setProperty('--beat', beat.toFixed(3))
    this.root.style.setProperty('--pulse', pulse.toFixed(3))
    this.root.style.setProperty('--life-t', this.localPhase.toFixed(3))
    this.root.style.setProperty('--sky-shift', skyShift.toFixed(3))

    this.drawWorld(beat, this.localPhase, dt)

    if (this.page === 'music' && this.sonicCanvas) this.drawSonic(beat, this.localPhase)
    if (this.page === 'scripts') this.tickLiturgy(now, beat)
    if (this.page === 'photography') this.tickPhoto(now, beat)
  }

  private resizeWorld(): void {
    const canvas = this.worldCanvas
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    this.worldCtx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private drawWorld(beat: number, t: number, dt: number): void {
    const canvas = this.worldCanvas
    const ctx = this.worldCtx
    if (!canvas || !ctx) return
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    ctx.clearRect(0, 0, w, h)

    switch (this.page) {
      case 'home':
        this.drawHomeOrbit(ctx, w, h, t, beat)
        break
      case 'video':
        this.drawJupiterBands(ctx, w, h, t, beat)
        this.drawChamberCraft(ctx, w, h, t, beat, 'film')
        break
      case 'music':
        this.drawSaturnAurora(ctx, w, h, t, beat)
        this.drawChamberCraft(ctx, w, h, t, beat, 'music')
        break
      case 'scripts':
        this.drawScriptRain(ctx, w, h, t, beat, dt)
        this.drawChamberCraft(ctx, w, h, t, beat, 'writing')
        break
      case 'photography':
        this.drawMarsDust(ctx, w, h, t, beat, dt)
        this.drawChamberCraft(ctx, w, h, t, beat, 'photo')
        break
      case 'technovate':
        this.drawNeptuneLattice(ctx, w, h, t, beat)
        break
    }
  }

  /**
   * Mirrored craft crest + performing figure for chamber planets
   * (echoes opening ArtSolarSystem flybys).
   */
  private drawChamberCraft(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
    craft: 'music' | 'writing' | 'film' | 'photo',
  ): void {
    const cx = w * 0.82
    const cy = h * 0.38
    const planetR = Math.min(64, w * 0.09)
    ctx.save()
    ctx.globalAlpha = 0.85

    // Soft planet disc under the craft scene
    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, planetR * 1.6)
    if (craft === 'music') {
      disc.addColorStop(0, 'rgba(210, 180, 100, 0.35)')
      disc.addColorStop(1, 'transparent')
    } else if (craft === 'writing') {
      disc.addColorStop(0, 'rgba(200, 180, 140, 0.32)')
      disc.addColorStop(1, 'transparent')
    } else if (craft === 'film') {
      disc.addColorStop(0, 'rgba(230, 140, 70, 0.35)')
      disc.addColorStop(1, 'transparent')
    } else {
      disc.addColorStop(0, 'rgba(200, 90, 50, 0.35)')
      disc.addColorStop(1, 'transparent')
    }
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(cx, cy, planetR * 1.6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle =
      craft === 'music'
        ? 'rgba(180, 150, 80, 0.45)'
        : craft === 'writing'
          ? 'rgba(170, 150, 120, 0.45)'
          : craft === 'film'
            ? 'rgba(190, 110, 55, 0.45)'
            : 'rgba(170, 70, 40, 0.45)'
    ctx.beginPath()
    ctx.arc(cx, cy, planetR, 0, Math.PI * 2)
    ctx.fill()

    // Crest above
    if (craft === 'music') {
      for (let i = 0; i < 3; i++) {
        const ang = t * 1.4 + i * 2.1
        const nx = cx + Math.cos(ang) * planetR * 0.7
        const ny = cy - planetR * 1.15 + Math.sin(ang) * planetR * 0.25
        ctx.fillStyle = 'rgba(255, 220, 140, 0.8)'
        ctx.beginPath()
        ctx.ellipse(nx, ny, 5, 3.5, 0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 220, 140, 0.8)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(nx + 4, ny)
        ctx.lineTo(nx + 4, ny - 12)
        ctx.stroke()
      }
    } else if (craft === 'writing') {
      const px = cx
      const py = cy - planetR * 1.2
      ctx.fillStyle = 'rgba(230, 210, 170, 0.85)'
      ctx.fillRect(px - 16, py - 18, 28, 34)
      ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)'
      ctx.strokeRect(px - 16, py - 18, 28, 34)
      const write = (t * 0.9) % 1
      ctx.strokeStyle = 'rgba(40, 50, 70, 0.55)'
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const prog = Math.max(0, Math.min(1, write * 4 - i))
        if (prog < 0.05) continue
        const yy = py - 8 + i * 7
        ctx.beginPath()
        ctx.moveTo(px - 10, yy)
        ctx.lineTo(px - 10 + 18 * prog, yy)
        ctx.stroke()
      }
      ctx.save()
      ctx.translate(px + 8, py)
      ctx.rotate(0.9 + Math.sin(t * 6) * 0.05)
      ctx.fillStyle = '#e8c040'
      ctx.fillRect(-2, -18, 4, 22)
      ctx.fillStyle = '#2a2430'
      ctx.beginPath()
      ctx.moveTo(-2, -18)
      ctx.lineTo(2, -18)
      ctx.lineTo(0, -24)
      ctx.fill()
      ctx.restore()
    } else if (craft === 'film') {
      // Statue crest: reel + vertical strip perched on the pole
      const crestY = cy - planetR * 1.35
      ctx.fillStyle = 'rgba(40, 28, 18, 0.55)'
      ctx.beginPath()
      ctx.ellipse(cx, cy - planetR * 0.95, 10, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      // Reel
      ctx.fillStyle = 'rgba(12, 10, 16, 0.92)'
      ctx.beginPath()
      ctx.arc(cx, crestY - 10, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(230, 190, 120, 0.65)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.save()
      ctx.translate(cx, crestY - 10)
      ctx.rotate(t * 0.6)
      ctx.strokeStyle = 'rgba(200, 160, 90, 0.45)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3)
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9)
        ctx.stroke()
      }
      ctx.restore()
      ctx.fillStyle = 'rgba(255, 210, 140, 0.65)'
      ctx.beginPath()
      ctx.arc(cx, crestY - 10, 2.5, 0, Math.PI * 2)
      ctx.fill()
      // Vertical film strip column
      const stripTop = crestY
      ctx.fillStyle = 'rgba(10, 8, 14, 0.92)'
      ctx.fillRect(cx - 9, stripTop, 18, 36)
      ctx.strokeStyle = 'rgba(230, 190, 120, 0.6)'
      ctx.strokeRect(cx - 9, stripTop, 18, 36)
      const scroll = (t * 0.7) % 1
      for (let i = 0; i < 3; i++) {
        const fy = stripTop + 4 + ((i + scroll) % 3) * 10
        ctx.fillStyle = `rgba(255, 180, 100, ${0.3 + 0.2 * Math.sin(t * 3 + i)})`
        ctx.fillRect(cx - 5, fy, 10, 7)
      }
      for (const side of [-1, 1] as const) {
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = 'rgba(200, 180, 140, 0.4)'
          ctx.beginPath()
          ctx.arc(cx + side * 7, stripTop + 5 + k * 6.5, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else {
      // Aperture
      ctx.save()
      ctx.translate(cx - 8, cy - planetR * 1.2)
      ctx.rotate(t * 0.5)
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2
        ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 20, 16, 0.8)' : 'rgba(55, 40, 30, 0.75)'
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, 18, a0, a0 + 0.9)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255, 200, 140, 0.6)'
      ctx.beginPath()
      ctx.arc(0, 0, 19, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // Mini polaroid
      ctx.fillStyle = 'rgba(240, 235, 220, 0.8)'
      ctx.fillRect(cx + 10, cy - planetR * 1.35, 18, 22)
      ctx.fillStyle = 'rgba(60, 40, 30, 0.7)'
      ctx.fillRect(cx + 13, cy - planetR * 1.3, 12, 12)
    }

    // Performing craftsperson on the limb
    const figX = cx + (craft === 'music' ? -12 : craft === 'writing' ? 10 : craft === 'film' ? -6 : 14)
    const figY = cy + planetR * 0.55
    const figH = 28 + beat * 6
    const body = 'rgba(20, 18, 28, 0.85)'
    const accent = 'rgba(230, 210, 170, 0.75)'
    ctx.save()
    ctx.translate(figX, figY)

    if (craft === 'music') {
      const sway = Math.sin(t * 6) * 0.15
      ctx.rotate(sway)
      ctx.strokeStyle = body
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-4, -6)
      ctx.lineTo(-8, 4)
      ctx.moveTo(4, -6)
      ctx.lineTo(10 + Math.sin(t * 6) * 3, 4)
      ctx.stroke()
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(0, -figH * 0.85)
      ctx.lineTo(6, -6)
      ctx.lineTo(-6, -6)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(0, -figH * 0.95, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = body
      ctx.beginPath()
      ctx.moveTo(3, -figH * 0.55)
      ctx.quadraticCurveTo(12, -figH * 0.9, 8, -figH * 1.1)
      ctx.stroke()
      ctx.strokeStyle = accent
      ctx.beginPath()
      ctx.arc(0, -figH * 0.95, 6, 0.2, 2.8)
      ctx.stroke()
    } else if (craft === 'writing') {
      const stroke = (t * 1.4) % 1
      ctx.strokeStyle = body
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-3, -8)
      ctx.quadraticCurveTo(-10, 0, -12, 5)
      ctx.moveTo(4, -7)
      ctx.lineTo(12, 3)
      ctx.stroke()
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(-2, -figH * 0.8)
      ctx.lineTo(5, -6)
      ctx.lineTo(-8, -5)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(3, -figH * 0.9, 3.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = accent
      ctx.fillRect(-2, -figH * 0.45, 16, 12)
      ctx.strokeStyle = 'rgba(40, 50, 70, 0.5)'
      ctx.beginPath()
      ctx.moveTo(0, -figH * 0.38)
      ctx.lineTo(0 + 12 * stroke, -figH * 0.38)
      ctx.stroke()
      ctx.strokeStyle = body
      ctx.beginPath()
      ctx.moveTo(-6, -figH * 0.55)
      ctx.lineTo(2 + stroke * 10, -figH * 0.35)
      ctx.stroke()
      ctx.fillStyle = '#e8c040'
      ctx.save()
      ctx.translate(2 + stroke * 10, -figH * 0.35)
      ctx.rotate(0.6)
      ctx.fillRect(-1.5, -8, 3, 9)
      ctx.restore()
    } else if (craft === 'film') {
      // Filmmaker blacks + clear camera operation
      const blacks = 'rgba(6, 6, 8, 0.92)'
      const pan = Math.sin(t * 2) * 0.14
      const focus = 0.5 + 0.5 * Math.sin(t * 3.1)
      ctx.strokeStyle = blacks
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-4 - pan * 2, -7)
      ctx.lineTo(-7 - pan, 5)
      ctx.moveTo(5 - pan * 2, -7)
      ctx.lineTo(8 - pan, 5)
      ctx.stroke()
      ctx.fillStyle = blacks
      ctx.beginPath()
      ctx.moveTo(pan * 2, -figH * 0.85)
      ctx.lineTo(6, -5)
      ctx.lineTo(-6, -5)
      ctx.fill()
      // Head to viewfinder
      ctx.beginPath()
      ctx.arc(3 + pan * 2, -figH * 0.92, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(14, 14, 16, 0.9)'
      ctx.beginPath()
      ctx.ellipse(3 + pan * 2, -figH * 0.98, 4.5, 2.2, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(11, -figH * 0.52)
      ctx.rotate(pan)
      ctx.fillStyle = blacks
      ctx.fillRect(-3, -6, 18, 11)
      ctx.strokeStyle = 'rgba(60, 60, 65, 0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(-3, -6, 18, 11)
      // Viewfinder
      ctx.fillStyle = 'rgba(50, 50, 55, 0.9)'
      ctx.fillRect(-8, -3, 6, 6)
      // Lens + focus ticks
      ctx.fillStyle = 'rgba(20, 20, 24, 0.95)'
      ctx.beginPath()
      ctx.arc(17, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(17, 0, 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.save()
      ctx.translate(17, 0)
      ctx.rotate(focus * Math.PI)
      ctx.strokeStyle = 'rgba(230, 210, 170, 0.55)'
      ctx.lineWidth = 0.9
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5)
        ctx.lineTo(Math.cos(a) * 6.2, Math.sin(a) * 6.2)
        ctx.stroke()
      }
      ctx.restore()
      ctx.fillStyle = Math.sin(t * 4) > 0.2 ? 'rgba(255,50,40,0.95)' : 'rgba(60,20,20,0.65)'
      ctx.beginPath()
      ctx.arc(2, -7, 2, 0, Math.PI * 2)
      ctx.fill()
      // View beam
      const beam = ctx.createLinearGradient(20, 0, 36, pan * 4)
      beam.addColorStop(0, 'rgba(255, 240, 200, 0.35)')
      beam.addColorStop(1, 'rgba(255, 240, 200, 0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(22, -3)
      ctx.lineTo(38, -8 + pan * 6)
      ctx.lineTo(38, 7 + pan * 6)
      ctx.lineTo(22, 3)
      ctx.fill()
      ctx.restore()
      // Operating arms
      ctx.strokeStyle = blacks
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(2, -figH * 0.55)
      ctx.quadraticCurveTo(10 + pan * 4, -figH * 0.5, 18 + pan * 3, -figH * 0.45)
      ctx.moveTo(-5, -figH * 0.55)
      ctx.lineTo(8 + pan * 2, -figH * 0.4)
      ctx.stroke()
    } else {
      const click = Math.sin(t * 3.5) > 0.85
      ctx.strokeStyle = body
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(-3, -6)
      ctx.lineTo(-8, 5)
      ctx.moveTo(6, -6)
      ctx.lineTo(10, 5)
      ctx.stroke()
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(2, -figH * 0.75)
      ctx.lineTo(7, -4)
      ctx.lineTo(-6, -4)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(5, -figH * 0.85, 3.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = body
      ctx.fillRect(6, -figH * 0.6, 12, 8)
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(20, -figH * 0.55, 4, 0, Math.PI * 2)
      ctx.fill()
      if (click) {
        const flash = ctx.createRadialGradient(24, -figH * 0.55, 0, 24, -figH * 0.55, 18)
        flash.addColorStop(0, 'rgba(255,250,230,0.7)')
        flash.addColorStop(1, 'transparent')
        ctx.fillStyle = flash
        ctx.beginPath()
        ctx.arc(24, -figH * 0.55, 18, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
    ctx.restore()
  }

  /** Hub — distant creative sun + four planet seeds in wide orbits */
  private drawHomeOrbit(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
  ): void {
    const cx = w * 0.72
    const cy = h * 0.28
    const sunR = 18 + beat * 8

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 8)
    glow.addColorStop(0, `rgba(255, 200, 120, ${0.14 + beat * 0.08})`)
    glow.addColorStop(0.35, 'rgba(120, 180, 255, 0.06)')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, sunR * 8, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 220, 150, ${0.55 + beat * 0.25})`
    ctx.fill()

    const planets = [
      { orbit: 52, speed: 0.55, color: 'rgba(180, 160, 120, 0.7)', r: 3.2 },
      { orbit: 78, speed: 0.38, color: 'rgba(61, 255, 180, 0.7)', r: 4.2 },
      { orbit: 108, speed: 0.26, color: 'rgba(240, 160, 90, 0.75)', r: 5.5 },
      { orbit: 142, speed: 0.18, color: 'rgba(200, 90, 60, 0.7)', r: 4 },
    ]

    for (let i = 0; i < planets.length; i++) {
      const p = planets[i]
      ctx.beginPath()
      ctx.ellipse(cx, cy, p.orbit, p.orbit * 0.42, -0.35, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(120, 180, 255, ${0.08 + i * 0.02})`
      ctx.lineWidth = 1
      ctx.stroke()

      const ang = t * p.speed + i * 1.4
      const px = cx + Math.cos(ang) * p.orbit
      const py = cy + Math.sin(ang) * p.orbit * 0.42
      ctx.beginPath()
      ctx.arc(px, py, p.r + beat * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
    }
  }

  /** Film / Jupiter — drifting warm atmospheric bands + sprocket marks */
  private drawJupiterBands(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
  ): void {
    for (const band of this.clouds) {
      const y = ((band.y + t * band.speed * 12) % (h + band.thick * 2)) - band.thick
      const g = ctx.createLinearGradient(0, y, 0, y + band.thick)
      const a = 0.04 + beat * 0.04
      if (band.hue < 0.5) {
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.4, `rgba(255, 150, 70, ${a})`)
        g.addColorStop(0.6, `rgba(200, 100, 50, ${a * 0.8})`)
        g.addColorStop(1, 'transparent')
      } else {
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.45, `rgba(90, 140, 200, ${a * 0.7})`)
        g.addColorStop(1, 'transparent')
      }
      ctx.fillStyle = g
      ctx.fillRect(0, y, w, band.thick)
    }

    // Film sprocket column — alien geometry of the frame-planet
    const sx = w * 0.94
    for (let i = 0; i < 14; i++) {
      const y = ((i * 48 + t * 28) % (h + 48)) - 24
      ctx.fillStyle = `rgba(255, 180, 100, ${0.12 + beat * 0.1})`
      ctx.fillRect(sx - 10, y, 14, 18)
      ctx.clearRect(sx - 6, y + 5, 6, 8)
      ctx.strokeStyle = `rgba(255, 200, 120, ${0.2 + beat * 0.15})`
      ctx.strokeRect(sx - 10, y, 14, 18)
    }

    // Soft "red spot" vortex
    const vx = w * 0.18
    const vy = h * 0.55 + Math.sin(t * 0.4) * 20
    const vr = 40 + beat * 18
    const spot = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr)
    spot.addColorStop(0, `rgba(220, 80, 50, ${0.18 + beat * 0.1})`)
    spot.addColorStop(0.55, 'rgba(180, 100, 60, 0.08)')
    spot.addColorStop(1, 'transparent')
    ctx.fillStyle = spot
    ctx.beginPath()
    ctx.ellipse(vx, vy, vr * 1.4, vr * 0.7, t * 0.15, 0, Math.PI * 2)
    ctx.fill()
  }

  /** Music / Saturn — wide vinyl-ring aurora across the sky */
  private drawSaturnAurora(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
  ): void {
    const cx = w * 0.5
    const cy = h * 0.72

    for (let i = 0; i < 5; i++) {
      const ry = 40 + i * 28 + Math.sin(t * 0.6 + i) * 6
      const rx = w * (0.35 + i * 0.08)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, -0.12, 0, Math.PI * 2)
      const alpha = 0.06 + (1 - i / 5) * 0.1 + beat * 0.08
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(61, 255, 180, ${alpha})`
          : `rgba(120, 200, 255, ${alpha * 0.85})`
      ctx.lineWidth = 1.5 + beat * 2
      ctx.stroke()
    }

    // Sonic aurora curtains
    for (let i = 0; i < 7; i++) {
      const x = (w / 7) * i + Math.sin(t * 0.7 + i) * 30
      const top = h * 0.05
      const height = h * (0.35 + Math.sin(t + i * 0.8) * 0.12 + beat * 0.1)
      const g = ctx.createLinearGradient(x, top, x, top + height)
      g.addColorStop(0, 'transparent')
      g.addColorStop(0.3, `rgba(80, 255, 180, ${0.08 + beat * 0.1})`)
      g.addColorStop(0.7, `rgba(100, 180, 255, ${0.06 + beat * 0.06})`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(x - 18, top, 36, height)
    }
  }

  /** Web / Neptune — soft orbital lattice + signal nodes */
  private drawNeptuneLattice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
  ): void {
    const cx = w * 0.72
    const cy = h * 0.36
    const planetR = Math.min(70, w * 0.1)

    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, planetR * 1.8)
    disc.addColorStop(0, `rgba(90, 170, 220, ${0.28 + beat * 0.12})`)
    disc.addColorStop(0.55, 'rgba(40, 90, 140, 0.16)')
    disc.addColorStop(1, 'transparent')
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(cx, cy, planetR * 1.8, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(50, 110, 160, 0.42)'
    ctx.beginPath()
    ctx.arc(cx, cy, planetR, 0, Math.PI * 2)
    ctx.fill()

    for (let i = 0; i < 4; i++) {
      const rx = planetR * (1.35 + i * 0.35)
      const ry = planetR * (0.35 + i * 0.08)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0.35 + i * 0.08, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(140, 210, 240, ${0.08 + (1 - i / 4) * 0.1 + beat * 0.05})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    for (let i = 0; i < 9; i++) {
      const ang = t * 0.55 + (i / 9) * Math.PI * 2
      const rad = planetR * (1.5 + (i % 3) * 0.35)
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad * 0.55
      ctx.fillStyle = `rgba(180, 230, 255, ${0.35 + beat * 0.35})`
      ctx.beginPath()
      ctx.arc(x, y, 2.2 + beat * 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(120, 200, 230, ${0.12 + beat * 0.08})`
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  /** Writing / Mercury — glyph rain falling like inscription ash */
  private drawScriptRain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
    dt: number,
  ): void {
    if (this.rain.length === 0) this.seedRain()

    // Distant crater sun / parchment glare
    const sun = ctx.createRadialGradient(w * 0.78, h * 0.18, 0, w * 0.78, h * 0.18, 160)
    sun.addColorStop(0, `rgba(220, 190, 140, ${0.12 + beat * 0.06})`)
    sun.addColorStop(1, 'transparent')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, w, h)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const drop of this.rain) {
      drop.y += drop.vy * (1 + beat * 0.6) * (dt * 60)
      if (drop.y > h + 20) {
        drop.y = -20 - Math.random() * 80
        drop.x = Math.random() * w
        drop.glyph = SCRIPT_GLYPHS[Math.floor(Math.random() * SCRIPT_GLYPHS.length)]
      }
      const wobble = Math.sin(t * 2 + drop.x * 0.01) * 4
      ctx.font = `${drop.size}px "Share Tech Mono", monospace`
      ctx.fillStyle = `rgba(200, 160, 100, ${drop.alpha + beat * 0.15})`
      ctx.fillText(drop.glyph, drop.x + wobble, drop.y)
    }
  }

  /** Photo / Mars — ochre dust + horizon haze */
  private drawMarsDust(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    beat: number,
    dt: number,
  ): void {
    if (this.dust.length === 0) this.seedDust()

    // Wind haze sheet
    const haze = ctx.createLinearGradient(0, h * 0.45, 0, h)
    haze.addColorStop(0, 'transparent')
    haze.addColorStop(0.4, `rgba(180, 80, 40, ${0.06 + beat * 0.04})`)
    haze.addColorStop(1, `rgba(120, 50, 30, ${0.12 + beat * 0.05})`)
    ctx.fillStyle = haze
    ctx.fillRect(0, h * 0.4, w, h * 0.6)

    for (const m of this.dust) {
      m.x += m.vx * (1 + beat) * (dt * 60)
      m.y += m.vy * (dt * 60) + Math.sin(t * 1.5 + m.x * 0.02) * 0.15
      if (m.x > w + 10) m.x = -10
      if (m.x < -10) m.x = w + 10
      if (m.y > h + 10) m.y = Math.random() * h * 0.7
      if (m.y < -10) m.y = h

      ctx.beginPath()
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(230, 160, 100, ${m.a + beat * 0.1})`
      ctx.fill()
    }
  }

  private seedClouds(): void {
    this.clouds = []
    for (let i = 0; i < 9; i++) {
      this.clouds.push({
        y: Math.random() * 900,
        speed: 0.15 + Math.random() * 0.45,
        thick: 28 + Math.random() * 50,
        hue: Math.random(),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  private seedRain(): void {
    this.rain = []
    const count = Math.min(48, Math.floor(window.innerWidth / 28))
    for (let i = 0; i < count; i++) {
      this.rain.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 0.6 + Math.random() * 1.8,
        glyph: SCRIPT_GLYPHS[Math.floor(Math.random() * SCRIPT_GLYPHS.length)],
        alpha: 0.15 + Math.random() * 0.4,
        size: 9 + Math.random() * 11,
      })
    }
  }

  private seedDust(): void {
    this.dust = []
    const count = Math.min(70, Math.floor(window.innerWidth / 18))
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 0.3 + Math.random() * 1.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 0.6 + Math.random() * 2.2,
        a: 0.12 + Math.random() * 0.35,
      })
    }
  }

  private resizeSonic(): void {
    const canvas = this.sonicCanvas
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const size = Math.min(720, Math.max(280, Math.floor(parent.clientWidth * 0.9)))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    this.sonicCtx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private drawSonic(beat: number, t: number): void {
    const canvas = this.sonicCanvas
    const ctx = this.sonicCtx
    if (!canvas || !ctx) return
    const w = canvas.clientWidth || 360
    const h = canvas.clientHeight || 360
    const cx = w / 2
    const cy = h / 2
    ctx.clearRect(0, 0, w, h)

    // Saturn body glow
    const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + beat * 20)
    body.addColorStop(0, `rgba(255, 220, 160, ${0.35 + beat * 0.2})`)
    body.addColorStop(0.5, `rgba(200, 170, 100, ${0.15 + beat * 0.1})`)
    body.addColorStop(1, 'transparent')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(cx, cy, 48 + beat * 12, 0, Math.PI * 2)
    ctx.fill()

    const rings = 8
    for (let i = 0; i < rings; i++) {
      const base = 32 + i * 20
      const wobble = Math.sin(t * (1.2 + i * 0.15) + i) * (4 + beat * 10)
      const rx = base + wobble + beat * 18
      const ry = rx * 0.28
      const alpha = 0.1 + (1 - i / rings) * 0.28 + beat * 0.12
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, -0.28, 0, Math.PI * 2)
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(61, 255, 160, ${alpha})`
          : `rgba(180, 200, 120, ${alpha * 0.75})`
      ctx.lineWidth = 1 + beat * 1.4
      ctx.stroke()
    }

    const notes = 14
    for (let i = 0; i < notes; i++) {
      const ang = t * 0.55 + (i / notes) * Math.PI * 2
      const rr = 55 + (i % 4) * 26 + beat * 12
      const x = cx + Math.cos(ang) * rr
      const y = cy + Math.sin(ang) * rr * 0.32
      ctx.beginPath()
      ctx.arc(x, y, 1.6 + beat * 2, 0, Math.PI * 2)
      ctx.fillStyle = i % 3 === 0 ? 'rgba(240,196,24,0.75)' : 'rgba(125,255,200,0.55)'
      ctx.fill()
    }
  }

  private seedLiturgy(): void {
    const col = this.liturgyCol
    if (!col || col.childElementCount > 0) return
    // Tablet chamber ships its own inscriptions — only seed empty liturgy columns
    for (let i = 0; i < 18; i++) {
      const span = document.createElement('span')
      span.className = 'liturgy-glyph'
      span.textContent = SCRIPT_GLYPHS[i % SCRIPT_GLYPHS.length]
      span.style.setProperty('--i', String(i))
      col.appendChild(span)
    }
  }

  private tickLiturgy(now: number, beat: number): void {
    const col = this.liturgyCol
    if (!col) return

    const tabletLines = col.querySelectorAll<HTMLElement>('.tablet-line:not(.muted)')
    if (tabletLines.length) {
      const interval = Math.max(900, 2200 - beat * 600)
      if (now - this.lastLiturgy < interval) return
      this.lastLiturgy = now
      tabletLines.forEach((line) => line.classList.remove('speak'))
      const idx = Math.floor(Math.random() * tabletLines.length)
      tabletLines[idx]?.classList.add('speak')
      return
    }

    if (col.childElementCount === 0) this.seedLiturgy()

    const interval = Math.max(280, 900 - beat * 420)
    if (now - this.lastLiturgy < interval) return
    this.lastLiturgy = now

    const glyphs = col.querySelectorAll<HTMLElement>('.liturgy-glyph')
    if (!glyphs.length) return
    const idx = Math.floor(Math.random() * glyphs.length)
    const g = glyphs[idx]
    g.classList.remove('speak')
    void g.offsetWidth
    g.textContent = SCRIPT_GLYPHS[Math.floor(Math.random() * SCRIPT_GLYPHS.length)]
    g.classList.add('speak')
  }

  private tickPhoto(now: number, beat: number): void {
    const interval = 5200 + (1 - beat) * 2800
    if (now - this.lastFlash > interval) {
      this.lastFlash = now
      this.flashEl?.classList.remove('fire')
      void this.flashEl?.offsetWidth
      this.flashEl?.classList.add('fire')

      const plates = this.root.querySelectorAll('.print-clip, .gold-plate')
      plates.forEach((p) => p.classList.remove('held'))
      const next = plates[this.holdIndex % plates.length]
      next?.classList.add('held')
      this.holdIndex++
    }
  }
}
