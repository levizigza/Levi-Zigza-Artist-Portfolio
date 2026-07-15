/**
 * Delicate iris paintbrush — starts at the pupil / black inner rim,
 * spirals progressively outward toward the limbus, then restarts.
 * Compact relative to the journey broom. After dive: paints the yellow brick road.
 */

export type BrushState = {
  progress: number
  time: number
  width: number
  height: number
  painting: boolean
  swayX: number
  swayY: number
  /** Rim intro sweep along the sun-eye edge */
  hero?: boolean
  eyeCx?: number
  eyeCy?: number
  eyeR?: number
  pupilR?: number
  /** Accumulate iris paint into this buffer (device pixels) */
  paintLayer?: HTMLCanvasElement | null
}

type IrisStroke = {
  x: number
  y: number
  a: number
  w: number
  hue: number
  sat: number
  lit: number
}

export class Paintbrush {
  private strokeTrail: IrisStroke[] = []
  private roadTrail: { x: number; y: number; a: number; w: number }[] = []
  private paintCtx: CanvasRenderingContext2D | null = null
  private paintKey = ''

  /** Clear accumulated iris paint (e.g. on journey restart). */
  resetPaint(): void {
    this.strokeTrail = []
    this.roadTrail = []
    if (this.paintCtx && this.paintCtx.canvas.width) {
      this.paintCtx.clearRect(0, 0, this.paintCtx.canvas.width, this.paintCtx.canvas.height)
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: BrushState): void {
    if (s.hero) {
      this.drawHero(ctx, s)
    } else {
      this.drawJourney(ctx, s)
    }
  }

  /** Tip of the brush in screen space — useful for hit diagnostics. */
  tipPosition(s: BrushState): { x: number; y: number } {
    if (s.hero) {
      const eyeCx = s.eyeCx ?? s.width * 0.5
      const eyeCy = s.eyeCy ?? s.height * 0.46
      const eyeR = s.eyeR ?? Math.min(s.width, s.height) * 0.39
      const pupilR = s.pupilR ?? eyeR * 0.28
      return this.heroTip(s.time, eyeCx, eyeCy, eyeR, pupilR, s.swayX, s.swayY)
    }
    return { x: s.width * 0.42, y: s.height * 0.58 }
  }

  /**
   * Inside → outside spiral: tip begins at the black pupil rim,
   * winds across the iris fibers, arrives at the outer limbus, then restarts.
   */
  private heroTip(
    time: number,
    eyeCx: number,
    eyeCy: number,
    eyeR: number,
    pupilR: number,
    swayX: number,
    swayY: number,
  ): { x: number; y: number; ang: number; r: number } {
    const cycle = 20 // seconds for one full pupil → limbus pass
    const phase = (time % cycle) / cycle
    let expand: number
    if (phase < 0.82) {
      // Slow progressive outward (ease-in-out)
      expand = this.smoothstep(phase / 0.82)
    } else if (phase < 0.9) {
      // Brief linger on the outer edge
      expand = 1
    } else {
      // Soft tuck back toward pupil before the next pass
      expand = 1 - this.smoothstep((phase - 0.9) / 0.1)
    }

    const inner = pupilR * 1.05
    const outer = eyeR * 0.97
    const baseR = inner + (outer - inner) * expand

    // Several orbits while expanding — irregular, living cadence
    const orbit = time * 0.68
    const ease = Math.sin(time * 0.31) * 0.2 + Math.sin(time * 0.77) * 0.11
    const ang = orbit + ease
    const radialWobble = Math.sin(time * 1.15 + ang * 2.2) * (outer - inner) * 0.028
    const r = baseR + radialWobble

    return {
      x: eyeCx + Math.cos(ang) * r + swayX * 0.1,
      y: eyeCy + Math.sin(ang) * r + swayY * 0.1,
      ang,
      r,
    }
  }

  private smoothstep(t: number): number {
    const x = Math.max(0, Math.min(1, t))
    return x * x * (3 - 2 * x)
  }

  private ensurePaint(layer: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const key = `${layer.width}x${layer.height}`
    if (!this.paintCtx || this.paintKey !== key || this.paintCtx.canvas !== layer) {
      this.paintCtx = layer.getContext('2d')
      this.paintKey = key
    }
    return this.paintCtx
  }

  private pickIrisHue(): { hue: number; sat: number; lit: number } {
    const roll = Math.random()
    if (roll < 0.42) return { hue: 195 + Math.random() * 40, sat: 70 + Math.random() * 25, lit: 48 + Math.random() * 22 }
    if (roll < 0.72) return { hue: 255 + Math.random() * 45, sat: 65 + Math.random() * 30, lit: 45 + Math.random() * 25 }
    if (roll < 0.9) return { hue: 165 + Math.random() * 28, sat: 60 + Math.random() * 30, lit: 42 + Math.random() * 22 }
    return { hue: 30 + Math.random() * 22, sat: 75 + Math.random() * 20, lit: 52 + Math.random() * 18 }
  }

  /** Tiny brush spiraling pupil-rim → outer iris. */
  private drawHero(ctx: CanvasRenderingContext2D, s: BrushState): void {
    const { width: w, height: h, time, painting } = s
    const eyeCx = s.eyeCx ?? w * 0.5
    const eyeCy = s.eyeCy ?? h * 0.46
    const eyeR = s.eyeR ?? Math.min(w, h) * 0.39
    const pupilR = s.pupilR ?? eyeR * 0.28
    const tip = this.heroTip(time, eyeCx, eyeCy, eyeR, pupilR, s.swayX ?? 0, s.swayY ?? 0)

    // Compact handle trails just behind the tip (tangential + slightly outward)
    const handleSwing = Math.sin(time * 0.55) * 0.18
    const handleR = tip.r + Math.max(18, eyeR * 0.085)
    const baseX =
      eyeCx + Math.cos(tip.ang + Math.PI * 0.42 + handleSwing) * handleR
    const baseY =
      eyeCy + Math.sin(tip.ang + Math.PI * 0.42 + handleSwing) * handleR

    // Durable strokes follow the same spiral path
    if (painting && s.paintLayer) {
      const pCtx = this.ensurePaint(s.paintLayer)
      if (pCtx) {
        const col = this.pickIrisHue()
        const prevAng = tip.ang - 0.05
        // Approximate previous radius along the spiral (tiny step back in time)
        const prev = this.heroTip(time - 0.035, eyeCx, eyeCy, eyeR, pupilR, 0, 0)
        const px = eyeCx + Math.cos(prevAng) * prev.r
        const py = eyeCy + Math.sin(prevAng) * prev.r
        pCtx.save()
        pCtx.globalCompositeOperation = 'lighter'
        pCtx.strokeStyle = `hsla(${col.hue}, ${col.sat}%, ${col.lit}%, 0.4)`
        pCtx.lineWidth = 1.1 + Math.random() * 2.2
        pCtx.lineCap = 'round'
        pCtx.beginPath()
        pCtx.moveTo(px, py)
        pCtx.quadraticCurveTo(
          (px + tip.x) * 0.5 + Math.cos(tip.ang) * 2,
          (py + tip.y) * 0.5 + Math.sin(tip.ang) * 2,
          tip.x,
          tip.y,
        )
        pCtx.stroke()

        const blot = pCtx.createRadialGradient(tip.x, tip.y, 0.5, tip.x, tip.y, 4 + Math.random() * 3)
        blot.addColorStop(0, `hsla(${col.hue}, ${col.sat}%, ${col.lit + 8}%, 0.2)`)
        blot.addColorStop(0.55, `hsla(${col.hue + 12}, ${col.sat}%, ${col.lit}%, 0.07)`)
        blot.addColorStop(1, 'hsla(0,0%,0%,0)')
        pCtx.fillStyle = blot
        pCtx.beginPath()
        pCtx.arc(tip.x, tip.y, 5, 0, Math.PI * 2)
        pCtx.fill()
        pCtx.restore()
      }
    }

    // Ephemeral wet trails along the spiral
    if (painting && Math.random() > 0.4) {
      const col = this.pickIrisHue()
      const jitter = (Math.random() - 0.5) * tip.r * 0.035
      this.strokeTrail.push({
        x: tip.x + Math.cos(tip.ang) * jitter + (Math.random() - 0.5) * 3,
        y: tip.y + Math.sin(tip.ang) * jitter + (Math.random() - 0.5) * 3,
        a: 0.85,
        w: 1.2 + Math.random() * 3.2,
        hue: col.hue,
        sat: col.sat,
        lit: col.lit,
      })
    }
    for (const t of this.strokeTrail) {
      t.a -= 0.026
    }
    this.strokeTrail = this.strokeTrail.filter((t) => t.a > 0.05)
    for (const t of this.strokeTrail) {
      const g = ctx.createRadialGradient(t.x, t.y, 0.5, t.x, t.y, t.w)
      g.addColorStop(0, `hsla(${t.hue}, ${t.sat}%, ${t.lit + 8}%, ${t.a * 0.65})`)
      g.addColorStop(0.55, `hsla(${t.hue}, ${t.sat}%, ${t.lit}%, ${t.a * 0.25})`)
      g.addColorStop(1, `hsla(${t.hue}, ${t.sat}%, ${t.lit}%, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(t.x, t.y, t.w, 0, Math.PI * 2)
      ctx.fill()
    }

    this.renderBrush(ctx, {
      baseX,
      baseY,
      tipX: tip.x,
      tipY: tip.y,
      time,
      painting,
      w,
      h,
      scale: 0.16,
      irisPaint: true,
    })
  }

  /** First-person broom painting the road after the pupil dive. */
  private drawJourney(ctx: CanvasRenderingContext2D, s: BrushState): void {
    const { width: w, height: h, time, progress: p, painting, swayX, swayY } = s

    const bob = Math.sin(time * (painting ? 4.2 : 1.4)) * (painting ? 16 : 6)
    const stroke = painting ? Math.sin(time * 5.8) * 28 : Math.sin(time * 1.8) * 10
    const baseX = w * 0.78 + swayX * 0.35 + stroke * 0.35
    const baseY = h * 1.02 + bob * 0.35 + swayY * 0.25
    const tipX = w * 0.42 + Math.sin(time * 2.6 + p * 6) * 36 + swayX
    const tipY = h * 0.58 + Math.cos(time * 2.1) * 14 + (painting ? -14 : 0)

    if (painting && Math.random() > 0.28) {
      this.roadTrail.push({
        x: tipX + (Math.random() - 0.5) * 48,
        y: tipY + (Math.random() - 0.5) * 18,
        a: 0.9,
        w: 10 + Math.random() * 28,
      })
    }
    for (const t of this.roadTrail) {
      t.a -= 0.018
      t.y += 0.55
    }
    this.roadTrail = this.roadTrail.filter((t) => t.a > 0.05)
    for (const t of this.roadTrail) {
      const g = ctx.createLinearGradient(t.x, t.y, t.x + t.w, t.y + 8)
      g.addColorStop(0, `rgba(255, 210, 60, ${t.a})`)
      g.addColorStop(0.6, `rgba(230, 170, 40, ${t.a * 0.85})`)
      g.addColorStop(1, `rgba(180, 120, 30, ${t.a * 0.4})`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(t.x, t.y, t.w, 5 + t.a * 4, -0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    if (painting) {
      const rg = ctx.createRadialGradient(tipX, tipY + 36, 4, tipX, tipY + 48, 120)
      rg.addColorStop(0, 'rgba(240, 190, 40, 0.65)')
      rg.addColorStop(0.45, 'rgba(220, 160, 50, 0.28)')
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.ellipse(tipX - 16, tipY + 42, 120, 28, -0.12, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(baseX - 40, h * 0.96, 160, 28, 0, 0, Math.PI * 2)
    ctx.fill()

    this.renderBrush(ctx, {
      baseX,
      baseY,
      tipX,
      tipY,
      time,
      painting,
      w,
      h,
      scale: 1,
      irisPaint: false,
    })
  }

  private renderBrush(
    ctx: CanvasRenderingContext2D,
    o: {
      baseX: number
      baseY: number
      tipX: number
      tipY: number
      time: number
      painting: boolean
      w: number
      h: number
      scale: number
      irisPaint: boolean
    },
  ): void {
    const { baseX, baseY, tipX, tipY, time, painting, w, h, scale, irisPaint } = o

    ctx.save()
    const ang = Math.atan2(tipY - baseY, tipX - baseX)
    ctx.translate(baseX, baseY)
    ctx.rotate(ang)

    const len = Math.hypot(tipX - baseX, tipY - baseY)
    const shaftHalf =
      Math.max(irisPaint ? 4.5 : 14, Math.min(w, h) * (irisPaint ? 0.008 : 0.028)) * scale

    const hg = ctx.createLinearGradient(0, -shaftHalf, 0, shaftHalf)
    hg.addColorStop(0, '#2a1a0c')
    hg.addColorStop(0.35, '#9a6e38')
    hg.addColorStop(0.55, '#c4924a')
    hg.addColorStop(0.75, '#6a4420')
    hg.addColorStop(1, '#1a1008')
    ctx.fillStyle = hg
    const hw = len * 0.7
    ctx.beginPath()
    ctx.moveTo(8 * scale, -shaftHalf)
    ctx.lineTo(hw - 10 * scale, -shaftHalf * 0.92)
    ctx.quadraticCurveTo(hw, -shaftHalf * 0.92, hw, -shaftHalf * 0.35)
    ctx.lineTo(hw, shaftHalf * 0.35)
    ctx.quadraticCurveTo(hw, shaftHalf * 0.92, hw - 10 * scale, shaftHalf * 0.92)
    ctx.lineTo(8 * scale, shaftHalf)
    ctx.quadraticCurveTo(0, shaftHalf, 0, shaftHalf * 0.4)
    ctx.lineTo(0, -shaftHalf * 0.4)
    ctx.quadraticCurveTo(0, -shaftHalf, 8 * scale, -shaftHalf)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = 'rgba(20, 12, 4, 0.4)'
    ctx.lineWidth = Math.max(0.6, 1.5 * scale)
    for (let i = 0; i < (irisPaint ? 3 : 6); i++) {
      const gy = -shaftHalf * 0.7 + i * ((shaftHalf * 1.4) / Math.max(1, irisPaint ? 2 : 5))
      ctx.beginPath()
      ctx.moveTo(14 * scale, gy)
      ctx.lineTo(len * 0.62, gy + Math.sin(i) * 2 * scale)
      ctx.stroke()
    }

    const ferruleX = len * 0.66
    const ferruleW = len * 0.09
    const ferruleH = shaftHalf * 2.35
    const fg = ctx.createLinearGradient(ferruleX, -ferruleH / 2, ferruleX, ferruleH / 2)
    fg.addColorStop(0, '#a87828')
    fg.addColorStop(0.45, '#f0e0a0')
    fg.addColorStop(1, '#6a5020')
    ctx.fillStyle = fg
    ctx.fillRect(ferruleX, -ferruleH / 2, ferruleW, ferruleH)

    ctx.strokeStyle = 'rgba(40, 28, 8, 0.55)'
    ctx.lineWidth = Math.max(0.8, 2.5 * scale)
    ctx.beginPath()
    ctx.moveTo(ferruleX + ferruleW * 0.2, -ferruleH / 2)
    ctx.lineTo(ferruleX + ferruleW * 0.2, ferruleH / 2)
    ctx.moveTo(ferruleX + ferruleW * 0.75, -ferruleH / 2)
    ctx.lineTo(ferruleX + ferruleW * 0.75, ferruleH / 2)
    ctx.stroke()

    const bx = ferruleX + ferruleW * 0.85
    const headSpread =
      Math.max(irisPaint ? 10 : 55, Math.min(w, h) * (irisPaint ? 0.028 : 0.11)) * scale
    const hairs = Math.floor(
      (irisPaint ? 28 : 56) * Math.min(1.2, Math.max(0.5, scale * (irisPaint ? 4 : 1))),
    )
    for (let i = 0; i < hairs; i++) {
      const t = i / Math.max(1, hairs - 1)
      const spread = (t - 0.5) * headSpread * 2
      const bend = Math.sin(time * 6.5 + i * 0.4) * (painting ? 7 * scale : 2.2 * scale)
      const tipLen = len * 0.28 + Math.sin(i * 1.3) * (irisPaint ? 3 : 10) * scale
      const wet = painting ? 0.95 : 0.5
      const hue = irisPaint ? 195 + (i % 7) * 18 : 48

      ctx.beginPath()
      ctx.moveTo(bx, spread * 0.22)
      ctx.quadraticCurveTo(
        bx + tipLen * 0.45,
        spread + bend,
        bx + tipLen,
        spread * 0.9 + bend * 1.5,
      )
      const hairGrad = ctx.createLinearGradient(bx, 0, bx + tipLen, 0)
      hairGrad.addColorStop(0, 'rgba(35, 24, 10, 0.85)')
      hairGrad.addColorStop(0.4, 'rgba(90, 68, 28, 0.9)')
      if (irisPaint) {
        hairGrad.addColorStop(0.72, `hsla(${hue}, 75%, 58%, ${wet})`)
        hairGrad.addColorStop(1, `hsla(${hue + 30}, 80%, 62%, ${wet * 0.85})`)
      } else {
        hairGrad.addColorStop(0.72, `rgba(230, 190, 55, ${wet})`)
        hairGrad.addColorStop(1, `rgba(200, 140, 40, ${wet * 0.8})`)
      }
      ctx.strokeStyle = hairGrad
      ctx.lineWidth =
        Math.max(0.55, (irisPaint ? 1.1 : 2.2) + (i % 4) * (irisPaint ? 0.35 : 0.7)) * scale
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    if (painting) {
      if (irisPaint) {
        ctx.fillStyle = 'rgba(140, 200, 255, 0.4)'
        ctx.beginPath()
        ctx.ellipse(bx + len * 0.22, 0, headSpread * 0.45, headSpread * 0.28, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = 'rgba(240, 200, 50, 0.6)'
        ctx.beginPath()
        ctx.ellipse(bx + len * 0.22, 0, headSpread * 0.55, headSpread * 0.32, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let d = 0; d < (irisPaint ? 3 : 5); d++) {
        const dx = bx + len * 0.18 + d * (irisPaint ? 5 : 10) * scale - 8 * scale
        const dy =
          (irisPaint ? 6 : 14) +
          Math.sin(time * 5 + d) * (irisPaint ? 3 : 6) +
          ((time * 28 + d * 50) % (irisPaint ? 14 : 28))
        if (irisPaint) {
          ctx.fillStyle = `hsla(${200 + d * 20}, 80%, 65%, ${0.45 - d * 0.08})`
        } else {
          ctx.fillStyle = `rgba(230, 180, 40, ${0.55 - d * 0.07})`
        }
        ctx.beginPath()
        ctx.ellipse(
          dx,
          dy,
          (irisPaint ? 1.6 : 3.5) * scale,
          (irisPaint ? 2.8 : 6) * scale,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
    }

    // Hand grip — muted / tiny for iris tool
    if (!irisPaint || scale > 0.25) {
      ctx.fillStyle = 'rgba(70, 42, 32, 0.92)'
      ctx.beginPath()
      ctx.ellipse(len * 0.12, shaftHalf * 0.15, shaftHalf * 1.8, shaftHalf * 1.35, 0.25, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(120, 78, 58, 0.7)'
      ctx.beginPath()
      ctx.ellipse(len * 0.2, -shaftHalf * 0.15, shaftHalf * 1.35, shaftHalf * 1.05, -0.35, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(85, 52, 40, 0.88)'
      ctx.beginPath()
      ctx.ellipse(len * 0.38, shaftHalf * 0.1, shaftHalf * 1.55, shaftHalf * 1.2, 0.15, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Subtle fingertips only on the miniature brush
      ctx.fillStyle = 'rgba(90, 55, 42, 0.75)'
      ctx.beginPath()
      ctx.ellipse(len * 0.18, shaftHalf * 0.2, shaftHalf * 1.6, shaftHalf * 1.1, 0.2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}
