/**
 * Creative-ideas brain — enter affordance in the pupil void below the name.
 * Particles, synaptic pulses, soft ribbons of color/light in a brain silhouette.
 */

export type BrainDrawState = {
  time: number
  cx: number
  cy: number
  /** Half-width of brain silhouette */
  size: number
  alpha: number
  /** Soft pulse for affordance hint */
  hover?: boolean
  /** Prefer calmer pulse (prefers-reduced-motion) */
  reducedMotion?: boolean
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
}

type Synapse = {
  a: number
  b: number
  phase: number
  speed: number
  hue: number
}

export class FlowingBrain {
  private particles: Particle[] = []
  private synapses: Synapse[] = []
  private seeded = false

  private seed(): void {
    if (this.seeded) return
    this.seeded = true
    for (let i = 0; i < 28; i++) {
      this.synapses.push({
        a: Math.random() * Math.PI * 2,
        b: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 2.4,
        hue: this.pickHue(),
      })
    }
  }

  private pickHue(): number {
    const roll = Math.random()
    if (roll < 0.4) return 195 + Math.random() * 40
    if (roll < 0.75) return 255 + Math.random() * 45
    if (roll < 0.9) return 165 + Math.random() * 25
    return 32 + Math.random() * 20
  }

  /** Hit-test: is (x,y) over the brain silhouette? */
  contains(px: number, py: number, cx: number, cy: number, size: number): boolean {
    const dx = (px - cx) / size
    const dy = (py - cy) / (size * 0.85)
    return dx * dx + dy * dy < 1.15
  }

  draw(ctx: CanvasRenderingContext2D, s: BrainDrawState): void {
    if (s.alpha < 0.01) return
    this.seed()
    const { time, cx, cy, size, alpha, hover, reducedMotion } = s

    // Clear tasteful blink — opacity + glow (slow; gentler under reduced-motion)
    const blinkHz = reducedMotion ? 0.55 : 1.15
    const blinkWave = Math.sin(time * Math.PI * 2 * blinkHz)
    // Square-ish soft blink: bright dwell then soft dim
    const blink =
      reducedMotion
        ? 0.78 + blinkWave * 0.12
        : 0.52 + (blinkWave * 0.5 + 0.5) * 0.48
    const glowPulse = reducedMotion
      ? 10 + blinkWave * 4
      : 12 + (blinkWave * 0.5 + 0.5) * 22
    const breath = 1 + Math.sin(time * 1.15) * (reducedMotion ? 0.015 : 0.035) + (hover ? 0.05 : 0)

    ctx.save()
    ctx.globalAlpha = alpha * blink
    ctx.translate(cx, cy)
    ctx.scale(breath, breath)

    // Soft aura — brightens with blink so the CTA reads clearly
    const aura = ctx.createRadialGradient(0, 0, size * 0.12, 0, 0, size * 1.45)
    aura.addColorStop(0, `rgba(160, 210, 255, ${0.18 + blink * 0.22})`)
    aura.addColorStop(0.4, `rgba(160, 90, 255, ${0.08 + blink * 0.12})`)
    aura.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(0, 0, size * 1.45, 0, Math.PI * 2)
    ctx.fill()

    // Silhouette path (two-hemisphere brain)
    ctx.save()
    this.brainPath(ctx, size)
    ctx.clip()

    // Inner wash
    const wash = ctx.createRadialGradient(-size * 0.1, -size * 0.05, 0, 0, 0, size)
    wash.addColorStop(0, 'rgba(40, 30, 70, 0.85)')
    wash.addColorStop(0.5, 'rgba(20, 40, 80, 0.7)')
    wash.addColorStop(1, 'rgba(8, 10, 24, 0.9)')
    ctx.fillStyle = wash
    ctx.fillRect(-size * 1.2, -size * 1.2, size * 2.4, size * 2.4)

    // Flowing ribbons (idea streams)
    for (let i = 0; i < 7; i++) {
      const hue = i % 3 === 0 ? 210 : i % 3 === 1 ? 280 : 170
      const t0 = time * (0.55 + i * 0.08) + i * 1.3
      ctx.strokeStyle = `hsla(${hue + Math.sin(t0) * 12}, 75%, 62%, ${0.28 + (i % 3) * 0.08})`
      ctx.lineWidth = size * (0.045 + (i % 2) * 0.02)
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let s = 0; s <= 18; s++) {
        const u = s / 18
        const ang = -Math.PI * 0.65 + u * Math.PI * 1.3 + Math.sin(t0 + u * 4) * 0.35
        const r = size * (0.25 + u * 0.55 + Math.sin(t0 * 1.4 + i + u * 6) * 0.08)
        const x = Math.cos(ang) * r * (i < 4 ? 1 : -0.85)
        const y = Math.sin(ang) * r * 0.78 + Math.sin(t0 + u * 3) * size * 0.06
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Synaptic arcs
    for (const syn of this.synapses) {
      const pulse = 0.5 + 0.5 * Math.sin(time * syn.speed + syn.phase)
      if (pulse < 0.35) continue
      const r0 = size * (0.2 + (Math.sin(syn.a) * 0.5 + 0.5) * 0.55)
      const r1 = size * (0.2 + (Math.cos(syn.b) * 0.5 + 0.5) * 0.55)
      const x0 = Math.cos(syn.a + time * 0.15) * r0
      const y0 = Math.sin(syn.a + time * 0.15) * r0 * 0.8
      const x1 = Math.cos(syn.b - time * 0.12) * r1
      const y1 = Math.sin(syn.b - time * 0.12) * r1 * 0.8
      ctx.strokeStyle = `hsla(${syn.hue}, 80%, 68%, ${pulse * 0.55})`
      ctx.lineWidth = 1.2 + pulse
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.quadraticCurveTo(
        (x0 + x1) * 0.5 + Math.sin(time + syn.phase) * size * 0.12,
        (y0 + y1) * 0.5 - size * 0.08,
        x1,
        y1,
      )
      ctx.stroke()

      // Traveling spark along arc
      const sparkT = (Math.sin(time * syn.speed * 0.7 + syn.phase) * 0.5 + 0.5)
      const sx = x0 + (x1 - x0) * sparkT
      const sy = y0 + (y1 - y0) * sparkT - Math.sin(sparkT * Math.PI) * size * 0.08
      ctx.fillStyle = `hsla(${syn.hue}, 90%, 75%, ${pulse})`
      ctx.beginPath()
      ctx.arc(sx, sy, 1.5 + pulse * 1.8, 0, Math.PI * 2)
      ctx.fill()
    }

    // Spawn / update idea particles
    if (Math.random() > 0.55) {
      const a = Math.random() * Math.PI * 2
      const r = size * (0.1 + Math.random() * 0.55)
      this.particles.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 0.8,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 14 - 4,
        life: 1,
        maxLife: 0.7 + Math.random() * 0.9,
        hue: this.pickHue(),
        size: 1.2 + Math.random() * 2.4,
      })
    }
    for (const p of this.particles) {
      p.x += p.vx * 0.016
      p.y += p.vy * 0.016
      p.life -= 0.016 / p.maxLife
      if (p.life > 0) {
        ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${p.life * 0.9})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0)

    ctx.restore() // clip

    // Outline glow — blink brightness
    ctx.strokeStyle = `rgba(180, 210, 255, ${0.35 + blink * 0.45})`
    ctx.lineWidth = 1.6 + blink * 0.8
    ctx.shadowColor = `rgba(140, 120, 255, ${0.35 + blink * 0.45})`
    ctx.shadowBlur = glowPulse + (hover ? 8 : 0)
    this.brainPath(ctx, size)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Hemispheric midline
    ctx.strokeStyle = `rgba(200, 220, 255, ${0.18 + blink * 0.2})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.72)
    ctx.quadraticCurveTo(size * 0.04, 0, 0, size * 0.78)
    ctx.stroke()

    // ENTER — strongest blink so the affordance is obvious
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `600 ${Math.max(9, Math.floor(size * 0.22))}px "Sora", sans-serif`
    ctx.shadowColor = `rgba(180, 210, 255, ${0.25 + blink * 0.55})`
    ctx.shadowBlur = 8 + blink * 14
    ctx.fillStyle = `rgba(240, 248, 255, ${0.4 + blink * 0.55})`
    ctx.fillText('ENTER', 0, size * 0.92)
    ctx.shadowBlur = 0

    ctx.restore()
  }

  private brainPath(ctx: CanvasRenderingContext2D, size: number): void {
    const s = size
    ctx.beginPath()
    // Left hemisphere
    ctx.moveTo(0, -s * 0.55)
    ctx.bezierCurveTo(-s * 0.15, -s * 0.95, -s * 1.05, -s * 0.75, -s * 0.95, -s * 0.1)
    ctx.bezierCurveTo(-s * 1.05, s * 0.35, -s * 0.7, s * 0.85, -s * 0.15, s * 0.75)
    ctx.quadraticCurveTo(-s * 0.05, s * 0.55, 0, s * 0.45)
    // Right hemisphere
    ctx.quadraticCurveTo(s * 0.05, s * 0.55, s * 0.15, s * 0.75)
    ctx.bezierCurveTo(s * 0.7, s * 0.85, s * 1.05, s * 0.35, s * 0.95, -s * 0.1)
    ctx.bezierCurveTo(s * 1.05, -s * 0.75, s * 0.15, -s * 0.95, 0, -s * 0.55)
    ctx.closePath()
  }
}
