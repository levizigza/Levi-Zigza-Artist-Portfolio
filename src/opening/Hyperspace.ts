/**
 * Cinematic hyperspace jump — black void + white/cyan star streaks
 * stretching into warp lines (Trek / Wars-style tunnel, procedural).
 */

export type HyperspaceState = {
  /** 0 at dive start → 1 at road arrival */
  t: number
  /** Independent Enter burst intensity 0–1 */
  burst?: number
  time: number
  width: number
  height: number
  cx: number
  cy: number
}

type Star = {
  angle: number
  /** Radial depth 0 (vanishing point) → 1 (screen edge) */
  depth: number
  speed: number
  hue: number
  bright: number
  thick: number
}

export class Hyperspace {
  private stars: Star[] = []
  private seeded = false
  private lastTime = -1

  reset(): void {
    this.stars = []
    this.seeded = false
    this.lastTime = -1
  }

  private seed(count = 220): void {
    if (this.seeded) return
    this.seeded = true
    for (let i = 0; i < count; i++) {
      this.stars.push({
        angle: Math.random() * Math.PI * 2,
        depth: Math.random(),
        speed: 0.55 + Math.random() * 1.45,
        hue: Math.random() < 0.72 ? 0 : Math.random() < 0.55 ? 190 : 210,
        bright: 0.55 + Math.random() * 0.45,
        thick: Math.random() < 0.18 ? 2.2 : Math.random() < 0.4 ? 1.4 : 1,
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D, s: HyperspaceState): void {
    const burst = Math.max(0, Math.min(1, s.burst ?? 0))
    const dive = Math.max(0, Math.min(1, s.t))
    const power = Math.max(dive, burst * 0.85)
    if (power <= 0.001) return

    this.seed()
    const { time, width: w, height: h, cx, cy } = s
    const dt =
      this.lastTime < 0 ? 0.016 : Math.min(0.05, Math.max(0, time - this.lastTime))
    this.lastTime = time
    const ease = power * power * (3 - 2 * power)

    // Speed envelope: slow stretch → full warp → brief boom-out near end
    const accel = smooth01(dive / 0.18)
    const boomOut = dive > 0.88 ? smooth01((dive - 0.88) / 0.12) : 0
    const boomIn = burst > 0.2 ? Math.pow(burst, 1.4) : 0
    const speed =
      (0.35 + accel * 2.8 + ease * 3.4 + boomIn * 2.2) * (1 + boomOut * 1.8)

    const maxR = Math.hypot(w, h) * 0.72
    const punch = 1 + boomIn * 0.12 + boomOut * 0.2

    ctx.save()
    ctx.globalAlpha = 1

    // Absolute black space
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    // Soft tunnel depth (subtle — black center, faint cyan rim)
    const tunnel = ctx.createRadialGradient(cx, cy, 2, cx, cy, maxR)
    tunnel.addColorStop(0, 'rgba(0, 0, 0, 1)')
    tunnel.addColorStop(0.35, 'rgba(0, 4, 12, 1)')
    tunnel.addColorStop(0.72, 'rgba(2, 10, 28, 0.55)')
    tunnel.addColorStop(1, 'rgba(0, 0, 0, 1)')
    ctx.fillStyle = tunnel
    ctx.fillRect(0, 0, w, h)

    // Perspective ring flashes — sparse, hard perspective cues
    const ringPulse = (time * (1.1 + speed * 0.35)) % 1
    for (let i = 0; i < 5; i++) {
      const u = ((i / 5) + ringPulse) % 1
      const r = 8 + u * u * maxR * punch
      const a = (1 - u) * (0.04 + ease * 0.1) * (1 - boomOut * 0.5)
      if (a < 0.01) continue
      ctx.strokeStyle = `rgba(120, 210, 255, ${a})`
      ctx.lineWidth = Math.max(1, 1.5 * (1 - u))
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Star streaks — stretch with speed (point → line as you jump)
    const stretch = 0.02 + speed * 0.085
    ctx.lineCap = 'round'
    ctx.globalCompositeOperation = 'lighter'

    for (const st of this.stars) {
      st.depth += st.speed * speed * dt * 0.55
      if (st.depth >= 1) {
        st.depth = Math.random() * 0.08
        st.angle = Math.random() * Math.PI * 2
      }

      const d0 = st.depth * st.depth
      const d1 = Math.min(1.05, d0 + stretch * st.speed * (0.55 + ease))
      const x0 = cx + Math.cos(st.angle) * d0 * maxR * punch
      const y0 = cy + Math.sin(st.angle) * d0 * maxR * punch
      const x1 = cx + Math.cos(st.angle) * d1 * maxR * punch
      const y1 = cy + Math.sin(st.angle) * d1 * maxR * punch

      // Near vanishing point: tiny dots; outward: long warp lines
      const len = Math.hypot(x1 - x0, y1 - y0)
      const alpha =
        st.bright *
        (0.2 + ease * 0.75) *
        (0.35 + d0 * 0.9) *
        (1 - boomOut * 0.35)

      if (len < 2.2) {
        ctx.fillStyle =
          st.hue === 0
            ? `rgba(245, 248, 255, ${alpha})`
            : `rgba(140, 220, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(x1, y1, st.thick * 0.55, 0, Math.PI * 2)
        ctx.fill()
        continue
      }

      const grad = ctx.createLinearGradient(x0, y0, x1, y1)
      if (st.hue === 0) {
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`)
        grad.addColorStop(0.35, `rgba(230, 240, 255, ${alpha * 0.45})`)
        grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`)
      } else {
        grad.addColorStop(0, `rgba(40, 120, 200, 0)`)
        grad.addColorStop(0.4, `rgba(80, 190, 255, ${alpha * 0.5})`)
        grad.addColorStop(1, `rgba(200, 245, 255, ${alpha})`)
      }
      ctx.strokeStyle = grad
      ctx.lineWidth = st.thick * (0.7 + ease * 0.9 + boomIn * 0.4)
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1

    // Vanishing-point core — void, not a bright plate
    const coreR = 3 + ease * 10 + boomOut * 40
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
    core.addColorStop(0, boomOut > 0.4 ? `rgba(220, 240, 255, ${boomOut * 0.55})` : '#000000')
    core.addColorStop(0.45, boomOut > 0.3 ? `rgba(100, 180, 255, ${boomOut * 0.25})` : 'rgba(0,0,0,0.9)')
    core.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(cx, cy, coreR * 1.4, 0, Math.PI * 2)
    ctx.fill()

    // Enter boom flash (brief cyan/white, not a long white veil)
    if (boomIn > 0.35) {
      const f = (boomIn - 0.35) / 0.65
      ctx.fillStyle = `rgba(180, 230, 255, ${f * f * 0.28})`
      ctx.fillRect(0, 0, w, h)
    }

    // Exit flash into origin myth
    if (boomOut > 0.15) {
      ctx.fillStyle = `rgba(232, 224, 200, ${boomOut * boomOut * 0.4})`
      ctx.fillRect(0, 0, w, h)
    }

    // Fade in from pupil black (early dive)
    if (dive < 0.1 && burst < 0.45) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - dive / 0.1})`
      ctx.fillRect(0, 0, w, h)
    }

    ctx.restore()
  }
}

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}
