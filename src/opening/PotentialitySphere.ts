/**
 * Opening gate seed — a small ball of potentiality in the void.
 * Brief presence only; detonation is driven by TitleSequence (no long charge gestation).
 */

export type PotentialityDrawState = {
  time: number
  width: number
  height: number
  /** 0 idle calm → 1 charged / about to detonate */
  charge?: number
  /** Mouse/hover proximity 0–1 */
  hover?: number
}

export function sphereLayout(width: number, height: number): {
  cx: number
  cy: number
  baseR: number
} {
  const cx = width * 0.5
  const cy = height * 0.48
  const baseR = Math.min(width, height) * 0.055
  return { cx, cy, baseR }
}

type Seed = {
  ang: number
  orbit: number
  speed: number
  size: number
  hue: number
  phase: number
}

export class PotentialitySphere {
  private seeds: Seed[] = []
  private seeded = false

  reset(): void {
    this.seeds = []
    this.seeded = false
  }

  private seed(): void {
    if (this.seeded) return
    this.seeded = true
    for (let i = 0; i < 28; i++) {
      this.seeds.push({
        ang: Math.random() * Math.PI * 2,
        orbit: 0.25 + Math.random() * 0.7,
        speed: 0.35 + Math.random() * 1.1,
        size: 0.8 + Math.random() * 2.2,
        hue: i % 3 === 0 ? 35 + Math.random() * 25 : 190 + Math.random() * 70,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: PotentialityDrawState): void {
    this.seed()
    const { time, width: w, height: h } = s
    const charge = Math.max(0, Math.min(1, s.charge ?? 0))
    const hover = Math.max(0, Math.min(1, s.hover ?? 0))
    const { cx, cy, baseR } = sphereLayout(w, h)

    // Amniotic void
    const voidG = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.hypot(w, h) * 0.72)
    voidG.addColorStop(0, '#060a12')
    voidG.addColorStop(0.35, '#030508')
    voidG.addColorStop(0.7, '#010206')
    voidG.addColorStop(1, '#000102')
    ctx.fillStyle = voidG
    ctx.fillRect(0, 0, w, h)

    // Distant dust of unrealized stars
    for (let i = 0; i < 90; i++) {
      const seed = i * 41.7
      const x = ((Math.sin(seed) * 0.5 + 0.5) * w)
      const y = ((Math.cos(seed * 1.37 + time * 0.015) * 0.5 + 0.5) * h)
      const a = 0.025 + (i % 7) * 0.008
      ctx.fillStyle = i % 5 === 0
        ? `rgba(230, 200, 150, ${a})`
        : `rgba(140, 170, 210, ${a * 0.8})`
      ctx.fillRect(x, y, 1 + (i % 3 === 0 ? 1 : 0), 1)
    }

    const breath = Math.sin(time * Math.PI * 0.55)
    const beat = Math.sin(time * Math.PI * 1.1)
    // Keep pulse subtle — long swell reads as a pre-boom "gestation" pause
    const pulse = 1 + breath * 0.035 + beat * 0.012 + charge * 0.1 + hover * 0.04
    const R = baseR * pulse

    // Soft outer containment aura
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 4; i++) {
      const rr = R * (2.2 + i * 1.15 + charge * 0.8)
      const g = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, rr)
      const a = (0.14 - i * 0.025) * (0.85 + charge * 0.4)
      g.addColorStop(0, `rgba(255, 245, 220, ${a * 1.2})`)
      g.addColorStop(0.35, `rgba(255, 200, 120, ${a * 0.55})`)
      g.addColorStop(0.65, `rgba(120, 160, 255, ${a * 0.25})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, rr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Tension rings when charged
    if (charge > 0.08) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      for (let i = 0; i < 3; i++) {
        const phase = (time * (0.8 + i * 0.2) + i * 0.33) % 1
        const rr = R * (1.4 + phase * (2.5 + charge * 2))
        const a = (1 - phase) * charge * 0.45
        ctx.strokeStyle = `hsla(${30 + i * 40}, 70%, 70%, ${a})`
        ctx.lineWidth = 1.2 + (1 - phase) * 2.5
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Core sphere body
    const core = ctx.createRadialGradient(
      cx - R * 0.25,
      cy - R * 0.3,
      R * 0.05,
      cx,
      cy,
      R * 1.15,
    )
    core.addColorStop(0, `rgba(255, 252, 245, ${0.95})`)
    core.addColorStop(0.2, `rgba(255, 230, 180, ${0.85})`)
    core.addColorStop(0.45, `rgba(255, 160, 80, ${0.55 + charge * 0.2})`)
    core.addColorStop(0.72, `rgba(90, 140, 220, ${0.45})`)
    core.addColorStop(1, `rgba(20, 30, 60, ${0.2})`)
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    // Inner radiance — light of potentiality
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.85)
    inner.addColorStop(0, `rgba(255, 255, 250, ${0.55 + breath * 0.15})`)
    inner.addColorStop(0.4, `rgba(255, 210, 140, ${0.28})`)
    inner.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2)
    ctx.fill()

    // Seeds of creation orbiting inside / around
    for (const seed of this.seeds) {
      const ang = seed.ang + time * seed.speed * (0.6 + charge)
      const orbit = R * seed.orbit * (0.95 + Math.sin(time * 1.4 + seed.phase) * 0.08)
      const x = cx + Math.cos(ang) * orbit
      const y = cy + Math.sin(ang * 1.08) * orbit * 0.88
      const sz = seed.size * (0.7 + charge * 0.5)
      const a = 0.35 + Math.sin(time * 2 + seed.phase) * 0.2 + charge * 0.25
      const sg = ctx.createRadialGradient(x, y, 0, x, y, sz * 2.4)
      sg.addColorStop(0, `hsla(${seed.hue}, 80%, 78%, ${a})`)
      sg.addColorStop(0.5, `hsla(${seed.hue + 20}, 70%, 55%, ${a * 0.35})`)
      sg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = sg
      ctx.beginPath()
      ctx.arc(x, y, sz * 2.4, 0, Math.PI * 2)
      ctx.fill()

      // Tiny voxel spark
      if (iBlock(seed.phase)) {
        ctx.fillStyle = `hsla(${seed.hue}, 90%, 85%, ${a * 0.7})`
        const bs = Math.max(1.2, sz * 0.7)
        ctx.fillRect(x - bs * 0.5, y - bs * 0.5, bs, bs)
      }
    }
    ctx.restore()

    // Barely-contained energy cracks
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = `rgba(255, 240, 200, ${0.18 + charge * 0.35 + Math.max(0, breath) * 0.1})`
    ctx.lineWidth = 0.8 + charge
    for (let i = 0; i < 5; i++) {
      const a0 = time * 0.3 + i * 1.256
      const r0 = R * 0.2
      const r1 = R * (0.85 + charge * 0.2)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0)
      ctx.quadraticCurveTo(
        cx + Math.cos(a0 + 0.4) * R * 0.55,
        cy + Math.sin(a0 + 0.4) * R * 0.55,
        cx + Math.cos(a0 + 0.7 + breath * 0.1) * r1,
        cy + Math.sin(a0 + 0.7 + breath * 0.1) * r1,
      )
      ctx.stroke()
    }
    ctx.restore()

    // Subtle brand whisper under the ball
    const nameA = 0.22 + breath * 0.06 + hover * 0.15
    ctx.save()
    ctx.globalAlpha = nameA
    ctx.fillStyle = 'rgba(200, 215, 240, 0.9)'
    ctx.font = `600 ${Math.max(11, Math.min(w, h) * 0.022)}px Syne, sans-serif`
    ctx.textAlign = 'center'
    ctx.letterSpacing = '0.22em'
    ctx.fillText('LEVI ZIGZA', cx, cy + R * 2.8 + Math.min(w, h) * 0.04)
    ctx.restore()
  }
}

function iBlock(phase: number): boolean {
  return Math.floor(phase * 10) % 3 === 0
}

