/**
 * Primordial origin — 8-bit / NES arcade myth:
 * grey noodle-sleeper drifts off → dream births the universe →
 * civilizations rise → little boy / alchemist idea-seed parable → site.
 * Low-res nearest-neighbor stage, limited palette, Bayer dithering, chunky sprites.
 */

export type OriginDrawState = {
  /** Local story progress 0–1 within the origin window */
  t: number
  time: number
  width: number
  height: number
  /** How strongly origin layer owns the frame (0 = gone, 1 = full) */
  alpha: number
}

/** Absolute journey progress windows for the origin arc */
export const ORIGIN = {
  voidHold: 0.02,
  /** Monster drifts, eyelids heavy */
  sleeperEnd: 0.11,
  /** Fully asleep — dream threshold */
  sleepEnd: 0.17,
  /** Dream blooms into cosmos */
  dreamEnd: 0.27,
  /** Varied civilizations tableau */
  civsEnd: 0.35,
  /** Boy walks barren field; alchemist plants → tall tree */
  alchemyEnd: 0.43,
  /** Boy’s idea-bubble → catch → plant sapling */
  seedEnd: 0.51,
  /** Counsel + shade under the tall tree */
  bloomEnd: 0.62,
  done: 0.66,
} as const

export function originLocalT(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= ORIGIN.bloomEnd) return 1
  return progress / ORIGIN.bloomEnd
}

export function originAlpha(progress: number, idle: boolean): number {
  if (idle) return 0
  if (progress <= 0) return 0
  if (progress < ORIGIN.voidHold) return progress / ORIGIN.voidHold
  if (progress <= ORIGIN.bloomEnd) return 1
  if (progress >= ORIGIN.done) return 0
  const u = (progress - ORIGIN.bloomEnd) / (ORIGIN.done - ORIGIN.bloomEnd)
  return 1 - u * u
}

/** Classic-limited NES / arcade palette */
const P = {
  black: '#0d0d14',
  void0: '#05050a',
  void1: '#12121c',
  void2: '#1c1c2a',
  white: '#f4f4f0',
  ash: '#9a9aa8',
  gray: '#5a5a6c',
  iron: '#3a3a48',
  ink: '#1a1a22',
  cream: '#e8e0c8',
  sand: '#c8b888',
  orange: '#e88838',
  amber: '#f0c040',
  red: '#c84040',
  rose: '#d86878',
  cyan: '#48b8e0',
  blue: '#3868b0',
  purple: '#7858b0',
  green: '#48a068',
  moss: '#2a6840',
  leaf: '#68c878',
  brown: '#6a4828',
  umber: '#3a2818',
  skin: '#5a3a28',
  skinDeep: '#3a2418',
  skinLite: '#7a5438',
  meat: '#8a6868',
} as const

/** 4×4 Bayer ordered dither thresholds (0–15) / 16 */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const

type Ripple = { r: number; life: number; max: number; hue: number; thick: number }
type Shard = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  warm: number
  spin: number
}
type Ember = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  hue: number
}
type Spark = {
  x: number
  y: number
  z: number
  size: number
  hue: number
  life: number
  vx: number
  vy: number
}

export class OriginStory {
  private ripples: Ripple[] = []
  private shards: Shard[] = []
  private embers: Ember[] = []
  private sparks: Spark[] = []
  private lastT = -1
  private sleepFired = false
  private dreamFired = false
  private seedFired = false
  private impactFlash = 0
  private camShake = 0
  private camPunch = 1
  private dustSeed = 0
  private smearT = 0
  /** Cosmos birth / body-pass moments — TitleSequence consumes for whoosh SFX. */
  private cosmosWhooshPending = false
  private lastCosmosWhooshT = -1

  /** Low-res 8-bit stage (nearest-neighbor upscaled each frame) */
  private stage: HTMLCanvasElement | null = null
  private stageCtx: CanvasRenderingContext2D | null = null
  private stageW = 0
  private stageH = 0

  reset(): void {
    this.ripples = []
    this.shards = []
    this.embers = []
    this.sparks = []
    this.lastT = -1
    this.sleepFired = false
    this.dreamFired = false
    this.seedFired = false
    this.impactFlash = 0
    this.camShake = 0
    this.camPunch = 1
    this.dustSeed = 0
    this.smearT = 0
    this.cosmosWhooshPending = false
    this.lastCosmosWhooshT = -1
  }

  /** Sleep → dream onset (drives Score drone; kept name for audio wiring). */
  isAumPhase(progress: number): boolean {
    return progress >= ORIGIN.sleeperEnd * 0.9 && progress < ORIGIN.dreamEnd + 0.02
  }

  /** Dream-drone intensity 0–1 — peaks as sleeper dreams the cosmos into being. */
  aumIntensity(progress: number): number {
    if (progress < ORIGIN.sleeperEnd) return 0
    if (progress < ORIGIN.sleepEnd) {
      const u = (progress - ORIGIN.sleeperEnd) / (ORIGIN.sleepEnd - ORIGIN.sleeperEnd)
      return u * 0.55
    }
    if (progress < ORIGIN.dreamEnd) {
      const u = (progress - ORIGIN.sleepEnd) / (ORIGIN.dreamEnd - ORIGIN.sleepEnd)
      if (u < 0.25) return 0.55 + (u / 0.25) * 0.45
      if (u < 0.7) return 1
      return 1 - ((u - 0.7) / 0.3) * 0.35
    }
    if (progress < ORIGIN.civsEnd) {
      return 0.55 * (1 - (progress - ORIGIN.dreamEnd) / (ORIGIN.civsEnd - ORIGIN.dreamEnd))
    }
    return 0
  }

  /**
   * Dream-cosmos sun / nova heat 0–1 during bloom.
   * Softer than the eye-gate sun; still drives crackle presence.
   */
  getDreamHeat(localT: number): number {
    const dreamStart = ORIGIN.sleepEnd / ORIGIN.bloomEnd
    const dreamPeak = ORIGIN.dreamEnd / ORIGIN.bloomEnd
    const civsEnd = ORIGIN.civsEnd / ORIGIN.bloomEnd
    if (localT < dreamStart) return 0
    if (localT < dreamPeak) {
      const u = (localT - dreamStart) / (dreamPeak - dreamStart)
      return Math.min(1, u * u * 1.15)
    }
    if (localT < civsEnd) {
      return 0.55 * (1 - (localT - dreamPeak) / (civsEnd - dreamPeak))
    }
    if (localT < civsEnd + 0.08) {
      return 0.2 * (1 - (localT - civsEnd) / 0.08)
    }
    return 0
  }

  /** True when a newborn-cosmos / body-pass moment wants a whoosh. */
  consumeCosmosWhoosh(): boolean {
    if (!this.cosmosWhooshPending) return false
    this.cosmosWhooshPending = false
    return true
  }

  draw(ctx: CanvasRenderingContext2D, s: OriginDrawState): void {
    if (s.alpha < 0.01) return
    const { t, time, width: dispW, height: dispH, alpha } = s
    this.syncEvents(t, time)

    const px = this.ensureStage(dispW, dispH)
    if (!px) return
    const { w, h, c } = px

    const shakeX = Math.round((Math.random() - 0.5) * this.camShake * 4)
    const shakeY = Math.round((Math.random() - 0.5) * this.camShake * 3)
    const punch = this.camPunch

    c.save()
    c.imageSmoothingEnabled = false
    c.fillStyle = P.void0
    c.fillRect(0, 0, w, h)

    c.translate(w * 0.5 + shakeX, h * 0.5 + shakeY)
    c.scale(punch, punch)
    c.translate(-w * 0.5, -h * 0.5)

    this.drawRadiantVoid(c, w, h, t, time)
    this.drawDreamCosmos(c, w, h, t, time)
    this.drawSleeperMonster(c, w, h, t, time)
    this.drawSleepWaves(c, w, h, t, time)
    this.drawCivilizations(c, w, h, t, time)
    this.drawBoyParable(c, w, h, t, time)
    this.drawRipples(c, w, h)
    this.drawEmbers(c, w, h)
    this.drawSparks(c, w, h)
    this.drawImpactFrame(c, w, h)
    c.restore()

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.stage!, 0, 0, w, h, 0, 0, dispW, dispH)
    ctx.restore()
  }

  private ensureStage(
    dispW: number,
    dispH: number,
  ): { w: number; h: number; c: CanvasRenderingContext2D } | null {
    const short = Math.min(dispW, dispH)
    const targetShort = short <= 720 ? 120 : short <= 1100 ? 144 : 168
    const scale = Math.max(3, Math.round(short / targetShort))
    const w = Math.max(80, Math.floor(dispW / scale))
    const h = Math.max(60, Math.floor(dispH / scale))

    if (!this.stage || !this.stageCtx || this.stageW !== w || this.stageH !== h) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const c = canvas.getContext('2d', { alpha: false })
      if (!c) return null
      c.imageSmoothingEnabled = false
      this.stage = canvas
      this.stageCtx = c
      this.stageW = w
      this.stageH = h
    }
    return { w, h, c: this.stageCtx! }
  }

  private syncEvents(t: number, _time: number): void {
    const absSleep = ORIGIN.sleeperEnd / ORIGIN.bloomEnd
    const absDream = ORIGIN.sleepEnd / ORIGIN.bloomEnd
    const absSeed = ORIGIN.civsEnd / ORIGIN.bloomEnd

    if (t >= absDream && !this.sleepFired) {
      this.sleepFired = true
      this.impactFlash = 0.85
      this.camShake = 0.7
      this.camPunch = 1.06
      this.smearT = 0.6
      this.spawnRippleBurst(0.06, 6, 2)
      this.spawnEmberBurst(24)
    }

    if (t >= ORIGIN.dreamEnd / ORIGIN.bloomEnd && !this.dreamFired) {
      this.dreamFired = true
      this.impactFlash = 1.25
      this.camShake = 1.55
      this.camPunch = 1.14
      this.smearT = 1
      this.spawnRippleBurst(0.1, 10, 3)
      this.spawnShards()
      this.spawnEmberBurst(64)
      this.spawnSparkBurst(52)
      this.cosmosWhooshPending = true
      this.lastCosmosWhooshT = t
    }

    // Sparse mid-dream flyby whooshes as stars / worlds rush past
    const dreamStart = ORIGIN.sleepEnd / ORIGIN.bloomEnd
    const civsEnd = ORIGIN.civsEnd / ORIGIN.bloomEnd
    if (t > dreamStart && t < civsEnd && t - this.lastCosmosWhooshT > 0.09) {
      if (Math.random() < 0.012) {
        this.cosmosWhooshPending = true
        this.lastCosmosWhooshT = t
      }
    }

    if (t >= absSeed && !this.seedFired) {
      this.seedFired = true
      this.impactFlash = 0.55
      this.camShake = 0.45
      this.spawnEmberBurst(18)
      this.spawnSparkBurst(16)
    }

    if (t > absSleep && t < ORIGIN.dreamEnd / ORIGIN.bloomEnd + 0.1) {
      const tick = Math.floor(t * 40)
      if (this.lastT < 0 || tick !== Math.floor(this.lastT * 40)) {
        if (Math.random() > 0.45) {
          this.ripples.push({
            r: 2 + Math.random() * 6,
            life: 0,
            max: 1.4 + Math.random(),
            hue: 30 + Math.random() * 40,
            thick: 1 + Math.random(),
          })
        }
      }
    }

    this.lastT = t
    this.impactFlash = Math.max(0, this.impactFlash - 0.045)
    this.camShake = Math.max(0, this.camShake * 0.86 - 0.02)
    this.camPunch += (1 - this.camPunch) * 0.14
    this.smearT = Math.max(0, this.smearT - 0.055)

    for (const r of this.ripples) {
      r.life += 0.02
      r.r += 1.2 + t * 1.5
    }
    this.ripples = this.ripples.filter((r) => r.life < r.max)

    for (const sh of this.shards) {
      sh.x += sh.vx * 0.016
      sh.y += sh.vy * 0.016
      sh.vx *= 0.99
      sh.vy *= 0.99
      sh.spin += 0.1
      sh.life -= 0.013
    }
    this.shards = this.shards.filter((sh) => sh.life > 0)

    for (const e of this.embers) {
      e.x += e.vx * 0.016
      e.y += e.vy * 0.016
      e.vx *= 0.985
      e.vy *= 0.985
      e.life -= 0.015
    }
    this.embers = this.embers.filter((e) => e.life > 0)

    for (const v of this.sparks) {
      v.x += v.vx * 0.016
      v.y += v.vy * 0.016
      v.vx *= 0.988
      v.vy *= 0.988
      v.life -= 0.01
      v.z += 0.02
    }
    this.sparks = this.sparks.filter((v) => v.life > 0)

    this.dustSeed += 0.016
  }

  private spawnRippleBurst(baseR: number, n: number, thick: number): void {
    for (let i = 0; i < n; i++) {
      this.ripples.push({
        r: baseR * (20 + i * 10),
        life: i * 0.04,
        max: 2.0 + i * 0.22,
        hue: 20 + i * 10 + Math.random() * 25,
        thick,
      })
    }
  }

  private spawnShards(): void {
    for (let i = 0; i < 42; i++) {
      const ang = (i / 42) * Math.PI * 2 + Math.random() * 0.5
      const spd = 36 + Math.random() * 130
      this.shards.push({
        x: 0,
        y: 0,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.88,
        life: 0.7 + Math.random() * 1.0,
        size: 1 + Math.random() * 4,
        warm: Math.random(),
        spin: Math.random() * Math.PI,
      })
    }
  }

  private spawnEmberBurst(n: number): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const spd = 18 + Math.random() * 110
      this.embers.push({
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.5 + Math.random() * 0.9,
        size: 1 + Math.random() * 2,
        hue: 20 + Math.random() * 40,
      })
    }
  }

  private spawnSparkBurst(n: number): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2
      const spd = 24 + Math.random() * 150
      this.sparks.push({
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
        z: Math.random(),
        size: 1 + Math.random() * 4,
        hue: Math.random() > 0.45 ? 0 : 1,
        life: 0.75 + Math.random() * 1.1,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.9,
      })
    }
  }

  private ditherAt(x: number, y: number, level: number): boolean {
    const bx = ((x | 0) % 4 + 4) % 4
    const by = ((y | 0) % 4 + 4) % 4
    return level * 16 > BAYER4[by][bx]
  }

  private px(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
    ctx.fillStyle = col
    ctx.fillRect(x | 0, y | 0, 1, 1)
  }

  private fillDitherDisc(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    col: string,
    density: number,
  ): void {
    const R = Math.ceil(r)
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy)
        if (d > r) continue
        const fall = 1 - d / Math.max(0.001, r)
        if (this.ditherAt(cx + dx, cy + dy, density * fall)) {
          this.px(ctx, cx + dx, cy + dy, col)
        }
      }
    }
  }

  private strokePixelRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    col: string,
    thick = 1,
  ): void {
    const steps = Math.max(12, Math.floor(r * Math.PI * 2))
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      for (let t = 0; t < thick; t++) {
        const rr = r - t
        if (rr < 0.5) continue
        this.px(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, col)
      }
    }
  }

  private drawPixelLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    col: string,
  ): void {
    const dx = x1 - x0
    const dy = y1 - y0
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)))
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      this.px(ctx, x0 + dx * u, y0 + dy * u, col)
    }
  }

  private drawRadiantVoid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    ctx.fillStyle = P.void0
    ctx.fillRect(0, 0, w, h)

    const dream = this.phase(t, ORIGIN.sleepEnd / ORIGIN.bloomEnd, ORIGIN.dreamEnd / ORIGIN.bloomEnd)
    const cx = w * 0.5
    const cy = h * 0.48
    const maxR = Math.hypot(w, h) * 0.55

    for (let y = 0; y < h; y += 2) {
      for (let x = y % 4 === 0 ? 0 : 1; x < w; x += 2) {
        const d = Math.hypot(x - cx, y - cy) / maxR
        const dens = Math.max(0, 0.5 - d * 0.65 + dream * 0.15)
        if (dens > 0.05 && this.ditherAt(x, y, dens)) {
          this.px(ctx, x, y, d < 0.3 ? P.void2 : P.void1)
        }
      }
    }

    for (let i = 0; i < 80; i++) {
      const seed = i * 47.13 + this.dustSeed * 0.15
      const dx = Math.floor((Math.sin(seed) * 0.5 + 0.5) * w)
      const dy = Math.floor((Math.cos(seed * 1.3 + time * 0.02) * 0.5 + 0.5) * h)
      const twinkle = (Math.floor(time * 6) + i) % 7 !== 0
      if (!twinkle) continue
      const a = 0.3 + ((i * 13) % 9) * 0.05 * (0.4 + dream * 0.6)
      if (this.ditherAt(dx, dy, a)) {
        this.px(ctx, dx, dy, i % 5 === 0 ? P.purple : i % 3 === 0 ? P.cyan : P.ash)
      }
    }
  }

  /**
   * Grey noodle-sleeper — original playful-eldritch (FSM-adjacent), not brand assets.
   * Soft meatball core, dangling tentacles, heavy lids as it drifts into sleep.
   */
  private drawSleeperMonster(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    const fade = 1 - this.phase(t, ORIGIN.dreamEnd / ORIGIN.bloomEnd, ORIGIN.civsEnd / ORIGIN.bloomEnd)
    if (fade < 0.02) return

    const drift = this.phase(t, 0, ORIGIN.sleeperEnd / ORIGIN.bloomEnd)
    const drowsy = this.phase(t, ORIGIN.sleeperEnd / ORIGIN.bloomEnd, ORIGIN.sleepEnd / ORIGIN.bloomEnd)
    const asleep = this.phase(t, ORIGIN.sleepEnd / ORIGIN.bloomEnd, ORIGIN.dreamEnd / ORIGIN.bloomEnd)

    const cx = Math.floor(w * 0.5)
    const cy = Math.floor(h * 0.42 + (1 - drift) * h * 0.08)
    const unit = Math.max(8, Math.min(w, h) * 0.09)
    const bob = Math.sin(time * (0.55 - drowsy * 0.35)) * (2.2 - asleep * 1.8)
    const sink = asleep * unit * 0.35

    ctx.save()
    ctx.globalAlpha = fade
    ctx.translate(cx, cy + bob + sink)

    // Soft ash penumbra
    this.fillDitherDisc(ctx, 0, 0, unit * 2.4, P.iron, 0.16 + drowsy * 0.08)
    this.fillDitherDisc(ctx, 0, 0, unit * 1.6, P.gray, 0.2)

    // Tentacles (noodly — weave under / around body)
    const lidClose = Math.min(1, drowsy * 0.55 + asleep * 0.85)
    for (let i = 0; i < 9; i++) {
      const baseAng = -0.2 + (i / 8) * (Math.PI + 0.4) + Math.sin(time * 0.4 + i) * 0.08
      const limp = 0.7 + lidClose * 0.55
      let px0 = Math.cos(baseAng) * unit * 0.55
      let py0 = Math.sin(baseAng) * unit * 0.35 + unit * 0.2
      for (let seg = 0; seg < 7; seg++) {
        const u = seg / 6
        const wave = Math.sin(time * (1.1 - lidClose * 0.7) + i * 1.3 + seg * 0.7) * (1 - lidClose * 0.7)
        const nx =
          Math.cos(baseAng + wave * 0.35) * unit * (0.7 + u * 1.55 * limp) +
          Math.sin(time * 0.3 + i) * u * 2
        const ny =
          Math.sin(baseAng * 0.85) * unit * (0.4 + u * 0.3) +
          u * u * unit * (1.6 + limp) +
          Math.abs(wave) * unit * 0.15
        const thick = Math.max(1, Math.round((1.8 - u) * (unit * 0.12)))
        const col = seg % 2 === 0 ? P.gray : P.ash
        this.drawPixelLine(ctx, px0, py0, nx, ny, col)
        // chunky noodle body
        ctx.fillStyle = i % 3 === 0 ? P.meat : P.gray
        ctx.fillRect(Math.floor(nx - thick * 0.5), Math.floor(ny - thick * 0.5), thick, thick)
        if (thick > 1) {
          ctx.fillStyle = P.ash
          ctx.fillRect(Math.floor(nx - thick * 0.5), Math.floor(ny - thick * 0.5), Math.max(1, thick - 1), 1)
        }
        px0 = nx
        py0 = ny
      }
      // tip nub
      ctx.fillStyle = P.meat
      ctx.fillRect(Math.floor(px0) - 1, Math.floor(py0) - 1, 3, 3)
    }

    // Central meatball body
    const br = unit * (1.05 + drift * 0.05)
    this.fillDitherDisc(ctx, 0, 0, br * 1.05, P.iron, 0.85)
    this.fillDitherDisc(ctx, 0, 0, br * 0.88, P.gray, 0.95)
    this.fillDitherDisc(ctx, -br * 0.15, -br * 0.2, br * 0.45, P.ash, 0.55)
    this.fillDitherDisc(ctx, br * 0.25, br * 0.1, br * 0.35, P.meat, 0.4)

    // Secondary meatball “eye-orb” bumps
    for (const [ox, oy, s] of [
      [-0.7, -0.55, 0.32],
      [0.75, -0.4, 0.28],
      [0.15, -0.9, 0.24],
    ] as const) {
      const er = unit * s
      this.fillDitherDisc(ctx, ox * unit, oy * unit, er, P.gray, 0.9)
      this.fillDitherDisc(ctx, ox * unit, oy * unit, er * 0.55, P.ash, 0.7)
    }

    // Eyes (close as sleep takes hold)
    const eyeY = -unit * 0.12
    for (const side of [-1, 1]) {
      const ex = side * unit * 0.38
      const ew = Math.max(2, Math.round(unit * 0.22))
      const ehOpen = Math.max(2, Math.round(unit * 0.28))
      const eh = Math.max(1, Math.round(ehOpen * (1 - lidClose * 0.92)))
      // sclera / void
      for (let dy = -eh; dy <= eh; dy++) {
        for (let dx = -ew; dx <= ew; dx++) {
          if ((dx * dx) / (ew * ew) + (dy * dy) / (Math.max(1, eh) * Math.max(1, eh)) <= 1) {
            this.px(ctx, ex + dx, eyeY + dy, P.ink)
          }
        }
      }
      if (eh >= 2 && lidClose < 0.85) {
        const pupil = Math.max(1, Math.round(unit * 0.08))
        ctx.fillStyle = P.amber
        ctx.fillRect(Math.floor(ex - pupil * 0.5), Math.floor(eyeY - pupil * 0.5), pupil, pupil)
        this.px(ctx, ex - 1, eyeY - 1, P.cream)
      }
      // heavy lid
      if (lidClose > 0.15) {
        const lidH = Math.round(ehOpen * lidClose * 0.7)
        ctx.fillStyle = P.gray
        ctx.fillRect(Math.floor(ex - ew - 1), Math.floor(eyeY - ehOpen), ew * 2 + 2, Math.max(1, lidH))
      }
    }

    // Soft Zzz when drowsy / asleep
    if (drowsy > 0.2 || asleep > 0.05) {
      const zAlpha = 0.4 + drowsy * 0.4 + asleep * 0.2
      ctx.globalAlpha = fade * zAlpha
      for (let zi = 0; zi < 3; zi++) {
        const zx = unit * (0.9 + zi * 0.35) + Math.sin(time * 0.8 + zi) * 2
        const zy = -unit * (0.9 + zi * 0.45) - (time * (8 + zi * 2) + zi * 20) % (unit * 1.8)
        const zs = 1 + zi
        ctx.fillStyle = zi % 2 === 0 ? P.ash : P.cyan
        // tiny Z glyph
        ctx.fillRect(Math.floor(zx), Math.floor(zy), zs * 3, 1)
        ctx.fillRect(Math.floor(zx + zs * 2), Math.floor(zy), 1, zs * 2)
        ctx.fillRect(Math.floor(zx), Math.floor(zy + zs * 2), zs * 3, 1)
      }
      ctx.globalAlpha = fade
    }

    ctx.restore()
  }

  /** Soft rings from the sleeper as dream pressure builds */
  private drawSleepWaves(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    const drowsy = this.phase(t, ORIGIN.sleeperEnd / ORIGIN.bloomEnd, ORIGIN.dreamEnd / ORIGIN.bloomEnd)
    if (drowsy < 0.05) return
    const fade = 1 - this.phase(t, ORIGIN.dreamEnd / ORIGIN.bloomEnd, ORIGIN.civsEnd / ORIGIN.bloomEnd)
    if (fade < 0.02) return

    const cx = w * 0.5
    const cy = h * 0.42
    const maxR = Math.min(w, h) * 0.5
    for (let i = 0; i < 5; i++) {
      const phase = (time * (0.35 + i * 0.05) + i * 0.2) % 1
      const r = phase * maxR * (0.5 + drowsy * 0.5)
      const dens = (1 - phase) * drowsy * fade * 0.55
      if (dens < 0.05) continue
      this.strokePixelRing(ctx, cx, cy, r, i % 2 === 0 ? P.purple : P.ash, 1)
      for (let s = 0; s < Math.floor(r * 4); s++) {
        const a = (s / Math.max(1, Math.floor(r * 4))) * Math.PI * 2
        const x = Math.floor(cx + Math.cos(a) * r)
        const y = Math.floor(cy + Math.sin(a) * r * 0.9)
        if (this.ditherAt(x, y, dens)) this.px(ctx, x, y, i % 2 === 0 ? P.cyan : P.gray)
      }
    }
  }

  /** Dream creates the universe — stars, nebulae, shard bloom from sleep */
  private drawDreamCosmos(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    const dream = this.phase(t, ORIGIN.sleepEnd / ORIGIN.bloomEnd, ORIGIN.dreamEnd / ORIGIN.bloomEnd)
    const hold = this.phase(t, ORIGIN.dreamEnd / ORIGIN.bloomEnd, 1)
    const strength = Math.max(dream, hold * 0.85)
    if (strength < 0.02) return

    const cx = w * 0.5
    const cy = h * 0.45
    const open = strength * strength

    // Birth disc
    this.fillDitherDisc(ctx, cx, cy, Math.min(w, h) * 0.12 * open, P.purple, 0.35 * open)
    this.fillDitherDisc(ctx, cx, cy, Math.min(w, h) * 0.08 * open, P.cyan, 0.4 * open)
    this.fillDitherDisc(ctx, cx, cy, Math.min(w, h) * 0.04 * open, P.cream, 0.55 * open)
    this.fillDitherDisc(ctx, cx, cy, Math.min(w, h) * 0.02 * open, P.ink, 0.8 * open)

    // Spiral arms of newborn cosmos
    const arms = 3
    for (let a = 0; a < arms; a++) {
      for (let u = 0; u < 1; u += 0.02) {
        const ang = a * ((Math.PI * 2) / arms) + u * 4.5 + time * 0.15
        const dist = u * Math.min(w, h) * 0.42 * open
        const x = Math.floor(cx + Math.cos(ang) * dist)
        const y = Math.floor(cy + Math.sin(ang) * dist * 0.62)
        if (!this.ditherAt(x, y, 0.35 + u * 0.4)) continue
        this.px(ctx, x, y, u < 0.3 ? P.cream : u < 0.6 ? P.cyan : P.purple)
        if (u % 0.08 < 0.02) this.px(ctx, x + 1, y, P.amber)
      }
    }

    // Star field populating dream
    for (let i = 0; i < 64; i++) {
      const seed = i * 19.7
      const ang = seed + time * (0.12 + (i % 5) * 0.03)
      const dist = (6 + (i % 16) * 4.5) * open * (0.5 + Math.sin(time + seed) * 0.3)
      const x = Math.floor(cx + Math.cos(ang) * dist)
      const y = Math.floor(cy + Math.sin(ang * 1.1) * dist * 0.7)
      const sz = Math.max(1, Math.round((1 + (i % 3)) * Math.min(1, open * 1.2)))
      if (!this.ditherAt(x, y, 0.4 * strength)) continue
      const cols = [P.amber, P.cyan, P.purple, P.white, P.rose, P.green]
      ctx.fillStyle = cols[i % cols.length]
      ctx.fillRect(x - Math.floor(sz * 0.5), y - Math.floor(sz * 0.5), sz, sz)
    }

    for (const sh of this.shards) {
      const s = Math.max(1, Math.round(sh.size))
      const col = sh.warm > 0.45 ? P.amber : P.cyan
      ctx.globalAlpha = Math.min(1, sh.life * strength)
      ctx.fillStyle = col
      ctx.fillRect(Math.floor(cx + sh.x - s * 0.5), Math.floor(cy + sh.y - s * 0.5), s, s)
      ctx.globalAlpha = 1
    }
  }

  /** Brief tableau — varied dream civilizations */
  private drawCivilizations(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    const enter = this.phase(t, ORIGIN.dreamEnd / ORIGIN.bloomEnd, ORIGIN.civsEnd / ORIGIN.bloomEnd)
    const exit = this.phase(t, ORIGIN.civsEnd / ORIGIN.bloomEnd, ORIGIN.alchemyEnd / ORIGIN.bloomEnd)
    const alpha = enter * (1 - exit * 0.95)
    if (alpha < 0.02) return

    ctx.save()
    ctx.globalAlpha = alpha

    const groundY = Math.floor(h * 0.72)
    // horizon band
    for (let x = 0; x < w; x += 2) {
      if (this.ditherAt(x, groundY, 0.4)) this.px(ctx, x, groundY, P.iron)
      if (this.ditherAt(x, groundY + 1, 0.25)) this.px(ctx, x, groundY + 1, P.gray)
    }

    const panelW = Math.floor(w * 0.22)
    const gap = Math.floor(w * 0.04)
    const startX = Math.floor(w * 0.08)
    const kinds = ['zig', 'dome', 'spire', 'ship'] as const

    for (let i = 0; i < 4; i++) {
      const bx = startX + i * (panelW + gap)
      const by = groundY
      const pop = Math.min(1, Math.max(0, (enter - i * 0.12) / 0.35))
      if (pop < 0.05) continue
      this.drawCivSprite(ctx, bx, by, panelW, kinds[i], pop, time + i)
    }

    // Tiny wanderers
    for (let i = 0; i < 6; i++) {
      const wx = Math.floor(w * (0.12 + i * 0.14) + Math.sin(time * 0.7 + i) * 3)
      const wy = groundY - 2 - (i % 2)
      ctx.fillStyle = i % 2 === 0 ? P.sand : P.cyan
      ctx.fillRect(wx, wy, 2, 3)
      this.px(ctx, wx, wy - 1, P.cream)
    }

    ctx.restore()
  }

  private drawCivSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    maxW: number,
    kind: 'zig' | 'dome' | 'spire' | 'ship',
    pop: number,
    time: number,
  ): void {
    const hMax = Math.floor(maxW * 0.85 * pop)
    const cx = x + Math.floor(maxW * 0.5)

    if (kind === 'zig') {
      // Stepped ziggurat
      for (let step = 0; step < 4; step++) {
        const ww = Math.floor(maxW * (0.9 - step * 0.18))
        const yy = groundY - Math.floor(((step + 1) / 4) * hMax)
        const hh = Math.floor(hMax / 4) + 1
        ctx.fillStyle = step % 2 === 0 ? P.sand : P.brown
        ctx.fillRect(cx - Math.floor(ww * 0.5), yy, ww, hh)
        ctx.fillStyle = P.cream
        ctx.fillRect(cx - Math.floor(ww * 0.5), yy, ww, 1)
      }
    } else if (kind === 'dome') {
      const r = Math.floor(hMax * 0.45)
      this.fillDitherDisc(ctx, cx, groundY - r, r, P.blue, 0.85)
      this.fillDitherDisc(ctx, cx, groundY - r, r * 0.65, P.cyan, 0.5)
      ctx.fillStyle = P.iron
      ctx.fillRect(cx - Math.floor(r * 0.35), groundY - 2, Math.floor(r * 0.7), 3)
      // banner
      const bx = cx + Math.floor(Math.sin(time) * 2)
      this.drawPixelLine(ctx, cx, groundY - r * 2, bx, groundY - r * 2 - 4, P.rose)
    } else if (kind === 'spire') {
      ctx.fillStyle = P.purple
      ctx.fillRect(cx - 2, groundY - hMax, 4, hMax)
      ctx.fillStyle = P.ash
      ctx.fillRect(cx - 5, groundY - Math.floor(hMax * 0.4), 10, Math.floor(hMax * 0.4))
      for (let i = 0; i < 3; i++) {
        this.px(ctx, cx - 1 + i, groundY - hMax - 2 - i, P.amber)
      }
      // window lights
      for (let i = 0; i < 5; i++) {
        if ((Math.floor(time * 3) + i) % 4 === 0) continue
        this.px(ctx, cx, groundY - 4 - i * 3, P.amber)
      }
    } else {
      // Dream-ship / sky barge
      const y = groundY - Math.floor(hMax * 0.55) + Math.floor(Math.sin(time * 1.2) * 2)
      ctx.fillStyle = P.gray
      ctx.fillRect(cx - 10, y, 20, 5)
      ctx.fillStyle = P.ash
      ctx.fillRect(cx - 7, y - 3, 14, 3)
      ctx.fillStyle = P.cyan
      ctx.fillRect(cx - 2, y - 8, 4, 5)
      // thruster flick
      if (Math.floor(time * 8) % 2 === 0) {
        ctx.fillStyle = P.orange
        ctx.fillRect(cx - 12, y + 2, 3, 2)
      }
    }
  }

  /**
   * Little boy / magical alchemist parable:
   * barren field → alchemist plants idea seed → tall tree →
   * boy’s idea-bubble → catch → sapling → counsel + shade.
   * Boy is visually a Black child (skin palette); narration says “little boy.”
   */
  private drawBoyParable(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    time: number,
  ): void {
    const civs = ORIGIN.civsEnd / ORIGIN.bloomEnd
    const alchemy = ORIGIN.alchemyEnd / ORIGIN.bloomEnd
    const seed = ORIGIN.seedEnd / ORIGIN.bloomEnd

    const enter = this.phase(t, civs, alchemy)
    if (enter < 0.02 && t < civs) return

    const walk = this.phase(t, civs, civs + (alchemy - civs) * 0.35)
    const plantAlchemy = this.phase(t, civs + (alchemy - civs) * 0.3, alchemy)
    const tallGrow = this.phase(t, civs + (alchemy - civs) * 0.55, alchemy)
    const bubble = this.phase(t, alchemy, alchemy + (seed - alchemy) * 0.45)
    const catchSeed = this.phase(
      t,
      alchemy + (seed - alchemy) * 0.35,
      alchemy + (seed - alchemy) * 0.65,
    )
    const plantBoy = this.phase(t, alchemy + (seed - alchemy) * 0.55, seed)
    const counsel = this.phase(t, seed, 1)
    const shade = this.phase(t, seed + (1 - seed) * 0.25, 1)
    const vision = this.phase(t, seed + (1 - seed) * 0.45, seed + (1 - seed) * 0.85)

    const fadeOut = 1 - this.phase(t, 0.92, 1)
    const alpha = Math.min(1, enter * 1.2) * fadeOut
    if (alpha < 0.02) return

    const groundY = Math.floor(h * 0.72)
    const unit = Math.max(6, Math.min(w, h) * 0.055)
    const alcX = Math.floor(w * 0.62)
    const treeX = Math.floor(w * 0.72)
    const sapX = Math.floor(w * 0.38)

    // Boy walks in from left across barren field
    const walkX = Math.floor(w * (0.12 + walk * 0.22 + Math.min(1, plantAlchemy) * 0.06))
    const sitShade = shade > 0.15
    const boyX = sitShade
      ? Math.floor(treeX - unit * 2.2 + Math.sin(time * 0.4) * 0.5)
      : walkX
    const boyY = groundY

    ctx.save()
    ctx.globalAlpha = alpha

    // Barren field ground — sparse grit, then soft moss near trees later
    const moss = Math.max(tallGrow * 0.45, plantBoy * 0.35, counsel * 0.55)
    for (let x = 0; x < w; x += 2) {
      const dens = 0.22 + moss * 0.2
      if (this.ditherAt(x, groundY, dens)) this.px(ctx, x, groundY, moss > 0.35 ? P.brown : P.umber)
      if (this.ditherAt(x, groundY + 1, dens * 0.7)) {
        this.px(ctx, x, groundY + 1, moss > 0.4 ? P.moss : P.iron)
      }
      // cracked barren flecks early
      if (walk > 0.05 && tallGrow < 0.6 && this.ditherAt(x, groundY - 1, 0.12)) {
        this.px(ctx, x, groundY - 1, P.sand)
      }
    }

    // Alchemist plants idea seed → sprouts into tall tree
    const alcPresent = plantAlchemy > 0.02 || tallGrow > 0.02 || counsel > 0.02
    if (alcPresent) {
      const alcAlpha = Math.min(1, plantAlchemy * 1.4 + counsel)
      ctx.save()
      ctx.globalAlpha = alpha * alcAlpha
      this.drawAlchemist(ctx, alcX, groundY, unit, time, plantAlchemy, counsel)
      ctx.restore()

      // Idea seed dropping from alchemist hand into soil, then sprouting
      if (plantAlchemy > 0.05 && tallGrow < 0.85) {
        const drop = Math.min(1, plantAlchemy / 0.55)
        const sx = treeX - 2
        const sy = groundY - Math.floor(unit * (1.4 - drop * 1.35))
        const pulse = 1 + Math.sin(time * 7) * 0.15
        this.fillDitherDisc(ctx, sx, sy, 2.5 * pulse, P.amber, 0.75)
        ctx.fillStyle = P.cream
        ctx.fillRect(Math.floor(sx) - 1, Math.floor(sy) - 1, 3, 3)
        // magic motes
        for (let i = 0; i < 6; i++) {
          const a = time * 2.2 + i
          if (this.ditherAt(i, Math.floor(time * 4), plantAlchemy * 0.7)) {
            this.px(
              ctx,
              Math.floor(sx + Math.cos(a) * (3 + i * 0.6)),
              Math.floor(sy + Math.sin(a * 1.4) * (2 + i * 0.4)),
              i % 2 === 0 ? P.purple : P.cyan,
            )
          }
        }
      }

      // Tall tree growth
      const tallH = Math.min(w, h) * 0.28 * Math.max(tallGrow, counsel * 0.95)
      if (tallH > 3) {
        // Soft future-wither vision during counsel
        const witherHint = vision * 0.55
        this.drawTree(ctx, treeX, groundY, tallH, 0, 0.7 + counsel * 0.3, witherHint, time)
      }
    }

    // Shade disk under tall tree
    if (shade > 0.05 && tallGrow > 0.4) {
      const shadeR = Math.min(w, h) * 0.14 * shade
      for (let dy = 0; dy < shadeR * 0.55; dy++) {
        for (let dx = -shadeR; dx <= shadeR; dx++) {
          const d = Math.hypot(dx, dy * 1.8)
          if (d > shadeR) continue
          const dens = (1 - d / shadeR) * shade * 0.45
          if (this.ditherAt(treeX + dx, groundY - 1 - dy, dens)) {
            this.px(ctx, treeX + dx, groundY - 1 - dy, P.ink)
          }
        }
      }
    }

    // Boy’s sapling after plant
    const sapGrow = Math.max(0, plantBoy * 0.85 + counsel * 0.15)
    if (sapGrow > 0.08) {
      const sapH = Math.min(w, h) * 0.07 * sapGrow
      this.drawTree(ctx, sapX, groundY, Math.max(4, sapH), 1, 0.2, 0, time)
      // Soft vision of his future mighty tree
      if (vision > 0.15) {
        ctx.save()
        ctx.globalAlpha = alpha * vision * 0.35
        this.drawTree(
          ctx,
          sapX,
          groundY,
          Math.min(w, h) * 0.26 * vision,
          0,
          0.9,
          0,
          time + 2,
        )
        ctx.restore()
      }
    }

    // Little boy sprite
    const catchPose = Math.max(0, catchSeed * (1 - plantBoy * 0.9))
    const kneel = plantBoy > 0.35 && plantBoy < 0.95 ? plantBoy : sitShade ? 0.35 : 0
    this.drawBoySprite(ctx, boyX, boyY, unit, time, {
      armReach: Math.max(bubble * 0.4, catchPose),
      kneel,
      sit: sitShade,
    })

    // Idea seed bubble from boy’s head → catch → plant
    if (bubble > 0.05 && plantBoy < 0.9) {
      const headY = boyY - Math.floor(unit * (1.95 - kneel * 0.35))
      let sx: number
      let sy: number
      if (catchSeed < 0.55) {
        // rising like a bubble
        const u = bubble
        const float = Math.sin(time * 3) * 1.5
        sx = boyX + 3 + u * 4
        sy = headY - 2 - u * unit * 1.1 + float
        // bubble ring
        this.strokePixelRing(ctx, sx, sy, 3 + u * 2, P.cyan, 1)
        for (let i = 0; i < 5; i++) {
          const a = time * 2 + i
          if (this.ditherAt(i, Math.floor(time * 5), bubble * 0.55)) {
            this.px(
              ctx,
              Math.floor(boyX + 3 + Math.cos(a) * (2 + i)),
              Math.floor(headY - Math.sin(a * 1.3) * (2 + i) - bubble * 5),
              i % 2 === 0 ? P.amber : P.cream,
            )
          }
        }
      } else if (plantBoy < 0.35) {
        // caught in hands
        sx = boyX + 7
        sy = boyY - Math.floor(unit * (1.15 - kneel * 0.2))
      } else {
        // lowering into dirt near sapling spot
        const u = (plantBoy - 0.35) / 0.55
        sx = sapX
        sy = boyY - Math.floor(unit * 0.9) + u * (groundY - (boyY - unit * 0.9) + 2)
      }
      const pulse = 1 + Math.sin(time * 6) * 0.2
      this.fillDitherDisc(ctx, sx, sy, 2.8 * pulse, P.amber, 0.75)
      ctx.fillStyle = P.cream
      ctx.fillRect(Math.floor(sx) - 1, Math.floor(sy) - 1, 3, 3)
      this.px(ctx, Math.floor(sx), Math.floor(sy), P.green)
      if (plantBoy > 0.55) {
        ctx.fillStyle = P.umber
        ctx.fillRect(sapX - 3, groundY - 1, 6, 3)
        this.px(ctx, sapX, groundY - 2, P.moss)
      }
    }

    // Counsel gesture — alchemist leans toward boy / soft sparkles between them
    if (counsel > 0.1) {
      for (let i = 0; i < 8; i++) {
        const u = i / 7
        const x = Math.floor(alcX + (boyX - alcX) * u + Math.sin(time * 2 + i) * 1.5)
        const y = Math.floor(groundY - unit * (1.2 + Math.sin(u * Math.PI) * 0.8))
        if (this.ditherAt(x, y, counsel * 0.5)) {
          this.px(ctx, x, y, i % 2 === 0 ? P.amber : P.purple)
        }
      }
    }

    // Soft pollen in shade beat
    if (shade > 0.2) {
      for (let i = 0; i < 14; i++) {
        const px = Math.floor(treeX + Math.sin(i * 9.1 + time * 0.5) * unit * 3)
        const py = Math.floor(groundY - 6 - ((time * 10 + i * 13) % (unit * 4)))
        if (this.ditherAt(px, py, 0.35 * shade)) {
          this.px(ctx, px, py, i % 3 === 0 ? P.amber : P.leaf)
        }
      }
    }

    ctx.restore()
  }

  /** Chunk little boy — deep brown skin (Black child in NES palette). */
  private drawBoySprite(
    ctx: CanvasRenderingContext2D,
    boyX: number,
    boyY: number,
    unit: number,
    time: number,
    pose: { armReach: number; kneel: number; sit: boolean },
  ): void {
    const squat = pose.sit ? 0.45 : pose.kneel * 0.4
    const legH = Math.floor(unit * (0.9 - squat * 0.5))
    // legs
    ctx.fillStyle = P.skin
    ctx.fillRect(boyX - 2, boyY - legH, 2, legH)
    ctx.fillRect(boyX + 2, boyY - legH, 2, legH)
    // torso
    ctx.fillStyle = P.skinDeep
    ctx.fillRect(boyX - 3, boyY - Math.floor(unit * (1.55 - squat * 0.35)), 8, Math.floor(unit * 0.7))
    ctx.fillStyle = P.blue
    ctx.fillRect(boyX - 3, boyY - Math.floor(unit * (1.55 - squat * 0.35)), 8, Math.floor(unit * 0.35))
    // arms
    const reach = pose.armReach
    ctx.fillStyle = P.skin
    ctx.fillRect(
      boyX - 5,
      boyY - Math.floor(unit * (1.2 + reach * 0.35 - squat * 0.2)),
      2,
      Math.floor(unit * 0.55),
    )
    const armY = boyY - Math.floor(unit * (1.15 + reach * 0.75 - squat * 0.25))
    ctx.fillRect(boyX + 6, armY, 2, Math.floor(unit * (0.55 - reach * 0.1)))
    // head — deep brown skin + soft highlight
    const headY = boyY - Math.floor(unit * (1.95 - squat * 0.4))
    ctx.fillStyle = P.skinDeep
    ctx.fillRect(boyX - 2, headY, 7, 7)
    ctx.fillStyle = P.skin
    ctx.fillRect(boyX - 1, headY + 2, 5, 4)
    ctx.fillStyle = P.skinLite
    ctx.fillRect(boyX - 1, headY + 1, 2, 2)
    // hair
    ctx.fillStyle = P.ink
    ctx.fillRect(boyX - 3, headY - 2, 9, 3)
    ctx.fillRect(boyX - 2, headY - 3, 7, 2)
    ctx.fillRect(boyX - 1, headY - 4, 5, 2)
    // eyes
    this.px(ctx, boyX, headY + 3, P.ink)
    this.px(ctx, boyX + 3, headY + 3, P.ink)
    // soft idle bob on walk
    if (!pose.sit && pose.kneel < 0.1 && Math.floor(time * 6) % 2 === 0) {
      this.px(ctx, boyX + 1, boyY - 1, P.umber)
    }
  }

  /** Magical alchemist — robe, hat tip, glowing staff. */
  private drawAlchemist(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    unit: number,
    time: number,
    planting: number,
    counsel: number,
  ): void {
    const lean = counsel * 2
    const bodyX = x - Math.floor(lean)
    // robe
    ctx.fillStyle = P.purple
    ctx.fillRect(bodyX - 4, groundY - Math.floor(unit * 1.7), 10, Math.floor(unit * 1.7))
    ctx.fillStyle = P.cream
    ctx.fillRect(bodyX - 2, groundY - Math.floor(unit * 1.55), 6, Math.floor(unit * 0.9))
    // head (lighter contrast to boy)
    const headY = groundY - Math.floor(unit * 2.15)
    ctx.fillStyle = P.sand
    ctx.fillRect(bodyX - 1, headY, 6, 6)
    ctx.fillStyle = P.cream
    ctx.fillRect(bodyX, headY + 1, 2, 2)
    // pointed hat
    ctx.fillStyle = P.amber
    ctx.fillRect(bodyX - 2, headY - 3, 8, 3)
    for (let i = 0; i < 4; i++) {
      this.px(ctx, bodyX + 2, headY - 4 - i, P.orange)
      this.px(ctx, bodyX + 1, headY - 4 - i, P.amber)
      this.px(ctx, bodyX + 3, headY - 4 - i, P.amber)
    }
    this.px(ctx, bodyX + 2, headY - 8, P.cream)
    // staff / planting hand
    const staffBend = planting > 0.2 && planting < 0.85 ? planting : counsel * 0.3
    const handY = groundY - Math.floor(unit * (1.3 - staffBend * 0.55))
    ctx.fillStyle = P.brown
    ctx.fillRect(bodyX + 7, handY - Math.floor(unit * 0.9), 2, Math.floor(unit * 1.1))
    this.fillDitherDisc(ctx, bodyX + 8, handY - Math.floor(unit * 0.95), 2.5, P.cyan, 0.7 + Math.sin(time * 4) * 0.15)
    // eyes
    this.px(ctx, bodyX + 1, headY + 2, P.ink)
    this.px(ctx, bodyX + 3, headY + 2, P.ink)
  }

  private drawTree(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    height: number,
    kind: number,
    live: number,
    die: number,
    time: number,
  ): void {
    if (height < 2) return
    const trunkH = Math.floor(height * 0.45)
    const trunkW = Math.max(2, Math.round(height * 0.08))
    const wither = die

    // Trunk
    ctx.fillStyle = wither > 0.5 ? P.umber : P.brown
    ctx.fillRect(x - Math.floor(trunkW * 0.5), groundY - trunkH, trunkW, trunkH)
    if (wither > 0.3) {
      // cracks / dead trunk lean suggestion
      this.px(ctx, x, groundY - Math.floor(trunkH * 0.5), P.ink)
    }

    if (wither > 0.85) {
      // stump only
      ctx.fillStyle = P.umber
      ctx.fillRect(x - trunkW, groundY - 3, trunkW * 2, 3)
      return
    }

    const canopyY = groundY - trunkH
    const canopyR = height * (0.35 + live * 0.08) * (1 - wither * 0.5)
    const leafCols =
      wither > 0.35
        ? [P.brown, P.orange, P.sand]
        : kind === 0
          ? [P.green, P.leaf, P.moss]
          : kind === 1
            ? [P.moss, P.green, P.cyan]
            : kind === 2
              ? [P.purple, P.rose, P.leaf]
              : [P.amber, P.orange, P.green]

    if (kind === 1) {
      // tall pine silhouette
      for (let i = 0; i < 4; i++) {
        const yy = canopyY - Math.floor(i * canopyR * 0.45)
        const ww = Math.floor(canopyR * (1.2 - i * 0.25))
        ctx.fillStyle = leafCols[i % leafCols.length]
        ctx.fillRect(x - Math.floor(ww * 0.5), yy, ww, Math.max(2, Math.floor(canopyR * 0.35)))
      }
    } else if (kind === 2) {
      // round fruiting canopy
      this.fillDitherDisc(ctx, x, canopyY - canopyR * 0.3, canopyR, leafCols[0], 0.85)
      this.fillDitherDisc(ctx, x - canopyR * 0.3, canopyY - canopyR * 0.5, canopyR * 0.5, leafCols[1], 0.7)
      // fruit dots
      for (let i = 0; i < 4; i++) {
        const a = time + i * 1.7
        this.px(
          ctx,
          Math.floor(x + Math.cos(a) * canopyR * 0.45),
          Math.floor(canopyY - canopyR * 0.3 + Math.sin(a) * canopyR * 0.35),
          leafCols[2],
        )
      }
    } else if (kind === 3) {
      // jagged creative tree
      for (let i = 0; i < 5; i++) {
        const a = -1.2 + i * 0.55
        const len = canopyR * (0.7 + (i % 2) * 0.3)
        this.drawPixelLine(
          ctx,
          x,
          canopyY,
          x + Math.cos(a) * len,
          canopyY - Math.sin(Math.abs(a)) * len,
          leafCols[i % leafCols.length],
        )
        ctx.fillStyle = leafCols[(i + 1) % leafCols.length]
        ctx.fillRect(
          Math.floor(x + Math.cos(a) * len) - 2,
          Math.floor(canopyY - Math.sin(Math.abs(a)) * len) - 2,
          4,
          4,
        )
      }
    } else {
      // classic round canopy
      this.fillDitherDisc(ctx, x, canopyY - canopyR * 0.4, canopyR, leafCols[0], 0.8)
      this.fillDitherDisc(ctx, x + canopyR * 0.25, canopyY - canopyR * 0.55, canopyR * 0.55, leafCols[1], 0.65)
      this.fillDitherDisc(ctx, x - canopyR * 0.2, canopyY - canopyR * 0.3, canopyR * 0.4, leafCols[2], 0.5)
    }

    // Live shimmer
    if (live > 0.2 && wither < 0.3) {
      for (let i = 0; i < 4; i++) {
        if ((Math.floor(time * 5) + i) % 3 !== 0) continue
        this.px(
          ctx,
          x + ((i * 3) % 7) - 3,
          canopyY - Math.floor(canopyR * 0.5) - i,
          P.cream,
        )
      }
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.ripples.length) return
    const cx = w * 0.5
    const cy = h * 0.45
    for (const r of this.ripples) {
      const u = r.life / r.max
      const dens = (1 - u) * 0.7
      const col = r.hue > 40 ? P.cyan : P.purple
      this.strokePixelRing(ctx, cx, cy, r.r, dens > 0.3 ? col : P.ash, Math.max(1, Math.round(r.thick)))
    }
  }

  private drawEmbers(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.embers.length) return
    const cx = w * 0.5
    const cy = h * 0.45
    for (const e of this.embers) {
      const s = Math.max(1, Math.round(e.size))
      const col = e.hue < 30 ? P.orange : e.hue < 45 ? P.amber : P.purple
      ctx.globalAlpha = Math.min(1, e.life)
      ctx.fillStyle = col
      ctx.fillRect(Math.floor(cx + e.x - s * 0.5), Math.floor(cy + e.y - s * 0.5), s, s)
      ctx.globalAlpha = 1
    }
  }

  private drawSparks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.sparks.length) return
    const cx = w * 0.5
    const cy = h * 0.45
    for (const v of this.sparks) {
      const s = Math.max(1, Math.round(v.size * (0.7 + v.z * 0.35)))
      const col = v.hue > 0.5 ? P.cyan : v.life > 0.5 ? P.amber : P.purple
      ctx.globalAlpha = Math.min(1, v.life)
      ctx.fillStyle = col
      ctx.fillRect(Math.floor(cx + v.x - s * 0.5), Math.floor(cy + v.y - s * 0.5), s, s)
      ctx.globalAlpha = 1
    }
  }

  private drawImpactFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.impactFlash < 0.02) return
    const f = this.impactFlash
    for (let y = 0; y < h; y++) {
      if ((y + Math.floor(f * 20)) % 2 === 0) continue
      for (let x = 0; x < w; x += 2) {
        if (this.ditherAt(x, y, f * f * 0.75)) {
          this.px(ctx, x, y, (x + y) % 4 < 2 ? P.cream : P.purple)
        }
      }
    }
    const cx = w * 0.5
    const cy = h * 0.5
    const maxR = Math.hypot(w, h) * 0.55
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const d = Math.hypot(x - cx, y - cy) / maxR
        if (d > 0.55 && this.ditherAt(x, y, (d - 0.55) * f * 1.4)) {
          this.px(ctx, x, y, P.black)
        }
      }
    }
  }

  private phase(t: number, a: number, b: number): number {
    if (t <= a) return 0
    if (t >= b) return 1
    const u = (t - a) / Math.max(0.0001, b - a)
    return u * u * (3 - 2 * u)
  }
}
