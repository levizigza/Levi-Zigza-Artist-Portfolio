/**
 * Universe birth detonation — Big Bang / potentiality rupture.
 * Anime impact frames + Minecraft chunky luminous matter flying outward.
 * Clears into the site as aftermath of creation.
 */

export type BigBangState = {
  /** 0 charge → 1 fully detonated / clearing */
  t: number
  time: number
  width: number
  height: number
  cx: number
  cy: number
}

type Chunk = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  spin: number
  hue: number
  life: number
  blocky: boolean
}

type Shard = {
  ang: number
  dist: number
  spd: number
  len: number
  hue: number
  w: number
}

type Ring = {
  r: number
  life: number
  max: number
  thick: number
  hue: number
}

export class BigBang {
  private chunks: Chunk[] = []
  private shards: Shard[] = []
  private rings: Ring[] = []
  private fired = false
  private impactFlash = 0
  private camShake = 0
  private camPunch = 1
  private lastU = -1

  reset(): void {
    this.chunks = []
    this.shards = []
    this.rings = []
    this.fired = false
    this.impactFlash = 0
    this.camShake = 0
    this.camPunch = 1
    this.lastU = -1
  }

  /** Intensity for audio swell alignment */
  intensity(t: number): number {
    if (t < 0.04) return (t / 0.04) * 0.35
    if (t < 0.14) return 0.35 + ((t - 0.04) / 0.1) * 0.65
    if (t < 0.5) return 1
    if (t < 0.82) return 1 - ((t - 0.5) / 0.32) * 0.55
    return 0.45 * (1 - (t - 0.82) / 0.18)
  }

  draw(ctx: CanvasRenderingContext2D, s: BigBangState): void {
    const { t, time, width: w, height: h, cx, cy } = s
    if (t <= 0.001) return

    this.sync(t, w, h)

    const shakeX = (Math.random() - 0.5) * this.camShake * 22
    const shakeY = (Math.random() - 0.5) * this.camShake * 16

    ctx.save()
    ctx.translate(cx + shakeX, cy + shakeY)
    ctx.scale(this.camPunch, this.camPunch)
    ctx.translate(-cx, -cy)

    // Phase curves — detonation almost immediate (no long charge gestation)
    const charge = smoothstep(0, 0.06, t)
    const boom = smoothstep(0.02, 0.2, t)
    const expand = smoothstep(0.1, 0.68, t)
    const clear = smoothstep(0.5, 1, t)
    const shock = boom * (1 - clear * 0.85)

    this.drawVoidIgnition(ctx, w, h, cx, cy, charge, boom, expand)
    this.drawCoreDetonation(ctx, w, h, cx, cy, t, charge, boom, expand)
    this.drawShockRings(ctx, cx, cy, Math.hypot(w, h), shock, time)
    this.drawAnimeSlashes(ctx, w, h, cx, cy, boom, expand, time)
    this.drawStreakField(ctx, cx, cy, Math.hypot(w, h), expand, boom, time)
    this.drawVoxelMatter(ctx, cx, cy, expand, clear)
    this.drawFilaments(ctx, cx, cy, Math.min(w, h), expand, boom, time)
    this.drawNebulaAftermath(ctx, w, h, cx, cy, expand, clear, time)
    this.drawImpactPlate(ctx, w, h, boom, clear)
    this.drawClearingVeil(ctx, w, h, clear)

    ctx.restore()
  }

  private sync(t: number, w: number, h: number): void {
    if (t >= 0.04 && !this.fired) {
      this.fired = true
      this.impactFlash = 1.25
      this.camShake = 1.8
      this.camPunch = 1.22
      this.spawnDetonation(w, h)
    }

    // Micro-pulses during peak
    if (t > 0.18 && t < 0.5) {
      const tick = Math.floor(t * 40)
      if (this.lastU < 0 || tick !== Math.floor(this.lastU * 40)) {
        if (Math.random() > 0.55) {
          this.rings.push({
            r: 20 + Math.random() * 40,
            life: 0,
            max: 1.2 + Math.random(),
            thick: 2 + Math.random() * 5,
            hue: 25 + Math.random() * 60,
          })
          this.camShake = Math.max(this.camShake, 0.35 + Math.random() * 0.4)
        }
      }
    }
    this.lastU = t

    this.impactFlash = Math.max(0, this.impactFlash - 0.038)
    this.camShake = Math.max(0, this.camShake * 0.9 - 0.015)
    this.camPunch += (1 - this.camPunch) * 0.1

    for (const c of this.chunks) {
      c.x += c.vx * 0.016
      c.y += c.vy * 0.016
      c.vx *= 0.992
      c.vy *= 0.992
      c.rot += c.spin
      c.life -= 0.008
    }
    this.chunks = this.chunks.filter((c) => c.life > 0)

    for (const r of this.rings) {
      r.life += 0.02
      r.r += 8 + t * 14
    }
    this.rings = this.rings.filter((r) => r.life < r.max)
  }

  private spawnDetonation(w: number, h: number): void {
    const maxR = Math.hypot(w, h)
    for (let i = 0; i < 120; i++) {
      const ang = Math.random() * Math.PI * 2
      const spd = 80 + Math.random() * 420
      this.chunks.push({
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 12,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.92,
        size: 2 + Math.random() * 14,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.25,
        hue: Math.random() > 0.45 ? 30 + Math.random() * 40 : 180 + Math.random() * 90,
        life: 0.7 + Math.random() * 1.2,
        blocky: Math.random() > 0.35,
      })
    }
    for (let i = 0; i < 90; i++) {
      this.shards.push({
        ang: (i / 90) * Math.PI * 2 + Math.random() * 0.2,
        dist: 4,
        spd: 0.55 + Math.random() * 1.6,
        len: 40 + Math.random() * 180,
        hue: i % 3 === 0 ? 25 + Math.random() * 30 : 200 + Math.random() * 80,
        w: 1 + Math.random() * 3.5,
      })
    }
    for (let i = 0; i < 10; i++) {
      this.rings.push({
        r: 8 + i * 14,
        life: i * 0.03,
        max: 1.8 + i * 0.12,
        thick: 8 - i * 0.5,
        hue: 20 + i * 18,
      })
    }
    void maxR
  }

  private drawVoidIgnition(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    charge: number,
    boom: number,
    expand: number,
  ): void {
    const R = Math.hypot(w, h) * (0.15 + expand * 0.9)
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R)
    g.addColorStop(0, `rgba(255, 252, 240, ${0.15 + charge * 0.5 + boom * 0.55})`)
    g.addColorStop(0.08, `rgba(255, 210, 120, ${0.35 * boom + 0.1 * charge})`)
    g.addColorStop(0.2, `rgba(255, 100, 50, ${0.28 * boom})`)
    g.addColorStop(0.38, `rgba(80, 60, 200, ${0.35 * expand})`)
    g.addColorStop(0.6, `rgba(8, 14, 40, ${0.55 * expand})`)
    g.addColorStop(1, `rgba(0, 1, 4, ${0.85})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }

  private drawCoreDetonation(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    t: number,
    charge: number,
    boom: number,
    expand: number,
  ): void {
    const base = Math.min(w, h)
    // Seed → rupture almost immediately (aligned with early boom curves)
    let coreR: number
    if (t < 0.05) {
      coreR = base * (0.04 + charge * 0.08)
    } else if (t < 0.18) {
      const u = (t - 0.05) / 0.13
      coreR = base * (0.1 + u * u * 0.55)
    } else {
      coreR = base * (0.65 + expand * 0.8)
    }

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
    core.addColorStop(0, `rgba(255, 255, 255, ${0.95 * Math.max(charge, boom)})`)
    core.addColorStop(0.12, `rgba(255, 240, 200, ${0.75 * boom})`)
    core.addColorStop(0.3, `rgba(255, 150, 60, ${0.45 * boom})`)
    core.addColorStop(0.55, `rgba(120, 100, 255, ${0.28 * expand})`)
    core.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
    ctx.fill()

    // Secondary hot shell
    if (boom > 0.2) {
      const shell = ctx.createRadialGradient(cx, cy, coreR * 0.35, cx, cy, coreR * 1.15)
      shell.addColorStop(0, 'rgba(0,0,0,0)')
      shell.addColorStop(0.45, `rgba(255, 180, 80, ${0.25 * boom})`)
      shell.addColorStop(0.7, `rgba(100, 180, 255, ${0.18 * boom})`)
      shell.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = shell
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 1.15, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawShockRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxR: number,
    shock: number,
    time: number,
  ): void {
    if (shock < 0.02 && !this.rings.length) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    for (let i = 0; i < 6; i++) {
      const phase = (time * (0.7 + i * 0.1) + i * 0.12) % 1
      const r = phase * maxR * 0.85 * (0.6 + shock)
      const a = (1 - phase) * shock * (0.5 - i * 0.05)
      if (a < 0.01) continue
      ctx.strokeStyle = `hsla(${18 + i * 22}, 75%, ${62 + i * 4}%, ${a})`
      ctx.lineWidth = 2 + (1 - phase) * 10
      ctx.beginPath()
      for (let a2 = 0; a2 <= Math.PI * 2 + 0.05; a2 += 0.07) {
        const wobble = 1 + Math.sin(a2 * 6 + time * 3 + i) * 0.04
        const x = cx + Math.cos(a2) * r * wobble
        const y = cy + Math.sin(a2) * r * wobble * 0.92
        if (a2 === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    for (const r of this.rings) {
      const u = r.life / r.max
      const a = (1 - u) * 0.55 * Math.max(shock, 0.4)
      ctx.strokeStyle = `hsla(${r.hue}, 65%, 70%, ${a})`
      ctx.lineWidth = r.thick * (1 - u * 0.5)
      ctx.beginPath()
      ctx.ellipse(cx, cy, r.r, r.r * 0.88, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawAnimeSlashes(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    boom: number,
    expand: number,
    time: number,
  ): void {
    const power = Math.max(boom, expand * 0.5)
    if (power < 0.15) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const n = Math.floor(12 + power * 20)
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + time * 0.5
      const r0 = Math.min(w, h) * 0.08
      const r1 = Math.hypot(w, h) * (0.35 + power * 0.35)
      const a = power * (0.12 + (i % 3) * 0.06)
      const g = ctx.createLinearGradient(
        cx + Math.cos(ang) * r0,
        cy + Math.sin(ang) * r0,
        cx + Math.cos(ang) * r1,
        cy + Math.sin(ang) * r1,
      )
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.3, `rgba(255, 240, 210, ${a})`)
      g.addColorStop(0.7, `rgba(180, 200, 255, ${a * 0.6})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1.5 + power * 3
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0)
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
      ctx.stroke()
    }

    // Chromatic plate split
    const chrom = boom * 0.9
    if (chrom > 0.1) {
      const off = 6 + chrom * 18
      const plates: [number, number, string][] = [
        [-off, 0, `rgba(255, 50, 70, ${0.14 * chrom})`],
        [off, 0, `rgba(50, 130, 255, ${0.16 * chrom})`],
        [0, off * 0.5, `rgba(80, 255, 200, ${0.1 * chrom})`],
      ]
      for (const [ox, oy, col] of plates) {
        const pg = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, Math.min(w, h) * 0.4)
        pg.addColorStop(0, col)
        pg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = pg
        ctx.fillRect(0, 0, w, h)
      }
    }
    ctx.restore()
  }

  private drawStreakField(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxR: number,
    expand: number,
    boom: number,
    time: number,
  ): void {
    const power = Math.max(expand, boom)
    if (power < 0.05) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (const sh of this.shards) {
      const travel = Math.min(1, (0.05 + expand * sh.spd) * (0.4 + boom))
      const r0 = sh.dist + travel * maxR * 0.15
      const r1 = r0 + sh.len * (0.4 + expand * 1.4)
      const ang = sh.ang + time * 0.04
      const cos = Math.cos(ang)
      const sin = Math.sin(ang)
      const x0 = cx + cos * r0
      const y0 = cy + sin * r0
      const x1 = cx + cos * r1
      const y1 = cy + sin * r1
      const g = ctx.createLinearGradient(x0, y0, x1, y1)
      const a = (0.45 + boom * 0.4) * (1 - expand * 0.35)
      g.addColorStop(0, `hsla(${sh.hue}, 90%, 80%, 0)`)
      g.addColorStop(0.25, `hsla(${sh.hue}, 85%, 72%, ${a})`)
      g.addColorStop(1, `hsla(${sh.hue + 30}, 70%, 60%, 0)`)
      ctx.strokeStyle = g
      ctx.lineWidth = sh.w * (1 + boom * 2)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawVoxelMatter(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    expand: number,
    clear: number,
  ): void {
    if (!this.chunks.length) return
    ctx.save()
    ctx.translate(cx, cy)
    for (const c of this.chunks) {
      const a = c.life * (0.85 - clear * 0.4) * (0.5 + expand)
      if (a < 0.02) continue
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(c.rot)
      ctx.globalAlpha = a
      if (c.blocky) {
        const s = c.size
        // Minecraft-style luminous block with face shade
        ctx.fillStyle = `hsla(${c.hue}, 70%, 62%, 0.95)`
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s)
        ctx.fillStyle = `hsla(${c.hue}, 80%, 78%, 0.7)`
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 0.28)
        ctx.fillStyle = `hsla(${c.hue}, 55%, 38%, 0.55)`
        ctx.fillRect(-s * 0.5, s * 0.15, s, s * 0.35)
        // Glow halo
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = `hsla(${c.hue}, 90%, 70%, ${0.25 * a})`
        ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4)
        ctx.globalCompositeOperation = 'source-over'
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c.size * 1.8)
        g.addColorStop(0, `hsla(${c.hue}, 90%, 80%, 0.9)`)
        g.addColorStop(0.5, `hsla(${c.hue + 15}, 75%, 55%, 0.4)`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, c.size * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.restore()
  }

  private drawFilaments(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    base: number,
    expand: number,
    boom: number,
    time: number,
  ): void {
    if (expand < 0.1) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const R = base * 0.35 * expand
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2 + time * 0.12
      ctx.strokeStyle = `hsla(${25 + i * 12}, 65%, 65%, ${0.12 * expand + 0.08 * boom})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a0) * R * 0.15, cy + Math.sin(a0) * R * 0.15)
      ctx.quadraticCurveTo(
        cx + Math.cos(a0 + 0.5) * R * 0.55,
        cy + Math.sin(a0 + 0.5) * R * 0.55,
        cx + Math.cos(a0 + 1.0) * R * 1.4,
        cy + Math.sin(a0 + 1.0) * R * 1.4,
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawNebulaAftermath(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    expand: number,
    clear: number,
    time: number,
  ): void {
    if (expand < 0.2) return
    const strength = expand * (1 - clear * 0.65)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    // Soft chamber/world seeds forming as aftermath
    for (let i = 0; i < 8; i++) {
      const ang = time * (0.08 + i * 0.02) + i * 0.9
      const orb = Math.min(w, h) * (0.18 + i * 0.06) * expand
      const px = cx + Math.cos(ang) * orb
      const py = cy + Math.sin(ang) * orb * 0.55
      const pr = 8 + i * 3
      const hues = [35, 200, 280, 160, 45, 310, 190, 20]
      const pg = ctx.createRadialGradient(px, py, 0, px, py, pr * 3)
      pg.addColorStop(0, `hsla(${hues[i]}, 60%, 70%, ${0.4 * strength})`)
      pg.addColorStop(0.5, `hsla(${hues[i]}, 50%, 45%, ${0.15 * strength})`)
      pg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(px, py, pr * 3, 0, Math.PI * 2)
      ctx.fill()

      // Chunky seed block
      ctx.globalAlpha = 0.35 * strength
      ctx.fillStyle = `hsla(${hues[i]}, 55%, 58%, 0.9)`
      const bs = 4 + i * 0.8
      ctx.fillRect(px - bs * 0.5, py - bs * 0.5, bs, bs)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  private drawImpactPlate(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    boom: number,
    clear: number,
  ): void {
    const f = Math.max(this.impactFlash, boom > 0.4 && boom < 0.75 ? (1 - Math.abs(boom - 0.55) * 3) * 0.6 : 0)
    if (f < 0.02) return
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = `rgba(255, 248, 235, ${f * f * (0.65 - clear * 0.3)})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  private drawClearingVeil(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    clear: number,
  ): void {
    if (clear < 0.05) return
    // Soft dissolve so the site underneath can read as aftermath
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(255, 248, 240, ${clear * clear * 0.55})`
    ctx.fillRect(0, 0, w, h)
    // Fade toward transparency cue (dark edges remaining)
    const vig = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.15,
      w * 0.5,
      h * 0.5,
      Math.hypot(w, h) * 0.55,
    )
    vig.addColorStop(0, `rgba(1, 2, 6, ${clear * 0.15})`)
    vig.addColorStop(0.55, `rgba(1, 2, 6, ${clear * 0.35})`)
    vig.addColorStop(1, `rgba(0, 0, 0, ${clear * 0.75})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }
}

function smoothstep(a: number, b: number, t: number): number {
  if (t <= a) return 0
  if (t >= b) return 1
  const u = (t - a) / (b - a)
  return u * u * (3 - 2 * u)
}
