/**
 * Cosmic path — journey through newborn creative worlds.
 * Soft alien geometry, nebulae, light-path (not hypostyle / labyrinth tomb).
 */

export type SceneDrawState = {
  progress: number
  time: number
  width: number
  height: number
  swayX: number
  swayY: number
  idle: boolean
}

type Brick = {
  depth: number
  lane: number
  wobble: number
  wet: number
}

export class LabyrinthScene {
  private bricks: Brick[] = []
  private lastBrickProgress = -1

  reset(): void {
    this.bricks = []
    this.lastBrickProgress = -1
  }

  syncBricks(progress: number): void {
    if (progress < this.lastBrickProgress) {
      this.bricks = []
      this.lastBrickProgress = -1
    }
    while (this.lastBrickProgress < progress) {
      this.lastBrickProgress = Math.min(1, this.lastBrickProgress + 0.012)
      const t = this.lastBrickProgress
      for (const lane of [-1, 0, 1]) {
        if (lane === 0 && Math.random() > 0.5) continue
        this.bricks.push({
          depth: 0.06 + t * 0.9 + Math.random() * 0.02,
          lane: lane + (Math.random() - 0.5) * 0.16,
          wobble: (Math.random() - 0.5) * 0.1,
          wet: 1,
        })
      }
    }
    for (const b of this.bricks) {
      b.wet = Math.max(0, b.wet - 0.008)
    }
    const minDepth = progress * 0.88 - 0.12
    this.bricks = this.bricks.filter((b) => b.depth > minDepth - 0.05)
  }

  draw(ctx: CanvasRenderingContext2D, s: SceneDrawState): void {
    const { width: w, height: h, progress: p, time, swayX, swayY } = s
    const cx = w * 0.5 + swayX
    const horizon = h * (0.34 + Math.sin(time * 0.28) * 0.012) + swayY * 0.45
    const vanishY = horizon
    const walk = p * 68 + time * 0.48

    // Deep space / early neon nebula sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#030510')
    sky.addColorStop(0.25, '#081428')
    sky.addColorStop(0.55, '#0a0c1a')
    sky.addColorStop(1, '#020206')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    this.drawNebula(ctx, w, h, cx, vanishY, p, time)

    // Soft world-glow at vanishing point — creative sun remnant
    const sanctum = 0.22 + p * 0.55
    const sg = ctx.createRadialGradient(cx, vanishY - h * 0.02, 4, cx, vanishY, h * 0.4)
    sg.addColorStop(0, `rgba(255, 220, 160, ${0.2 * sanctum})`)
    sg.addColorStop(0.28, `rgba(100, 180, 255, ${0.12 * sanctum})`)
    sg.addColorStop(0.55, `rgba(160, 100, 220, ${0.08 * sanctum})`)
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, w, h)

    // Floor of night — soft void plane
    const floor = ctx.createLinearGradient(0, vanishY, 0, h)
    floor.addColorStop(0, '#060814')
    floor.addColorStop(0.45, '#04060e')
    floor.addColorStop(1, '#010206')
    ctx.fillStyle = floor
    ctx.fillRect(0, vanishY, w, h - vanishY)

    this.drawOrganicWalls(ctx, w, h, cx, vanishY, walk, p, 0.48, 0.16)
    this.drawOrganicWalls(ctx, w, h, cx, vanishY, walk * 1.4, p, 0.72, 0.3)
    this.drawOrganicWalls(ctx, w, h, cx, vanishY, walk * 2.05, p, 0.92, 0.45)
    this.drawWorldSpires(ctx, w, h, cx, vanishY, walk, p, time)
    this.drawChamberGate(ctx, cx, vanishY, w, h, p, time)
    this.drawLightPath(ctx, w, h, cx, vanishY, p, time)
    this.drawNearVeil(ctx, w, h, cx, walk, p, time)

    // Floating motes — first-light leftovers
    for (let i = 0; i < 24; i++) {
      const seed = i * 97.13
      const mx = ((Math.sin(time * 0.32 + seed) * 0.5 + 0.5) * w + walk * 12) % w
      const my = vanishY + ((Math.cos(time * 0.26 + seed) * 0.5 + 0.5) * (h - vanishY) * 0.75)
      const hue = i % 3 === 0 ? 35 : i % 3 === 1 ? 200 : 280
      ctx.fillStyle = `hsla(${hue}, 55%, 68%, ${0.1 + (i % 5) * 0.025})`
      ctx.beginPath()
      ctx.arc(mx, my, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawNebula(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    vanishY: number,
    p: number,
    time: number,
  ): void {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 3; i++) {
      const ox = cx + Math.sin(time * 0.08 + i * 2) * w * 0.18
      const oy = vanishY * (0.35 + i * 0.12) + Math.cos(time * 0.06 + i) * 20
      const g = ctx.createRadialGradient(ox, oy, 10, ox, oy, w * (0.28 + i * 0.08))
      const hues = [200, 30, 270]
      g.addColorStop(0, `hsla(${hues[i]}, 50%, 55%, ${0.07 + p * 0.04})`)
      g.addColorStop(0.5, `hsla(${hues[i] + 20}, 40%, 40%, ${0.04})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h * 0.7)
    }
    ctx.restore()
  }

  /** Curved membrane walls — organic alien geometry, not temple columns */
  private drawOrganicWalls(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    vanishY: number,
    walk: number,
    p: number,
    sideScale: number,
    darkness: number,
  ): void {
    const segments = 14
    for (const side of [-1, 1]) {
      for (let i = 0; i < segments; i++) {
        const depth = (i + ((walk * 0.5) % 1)) / segments
        const z = depth * depth
        const near = 1 - z
        const pulse = 1 + Math.sin(i * 0.8 + walk * 0.08 + p * 4) * 0.06
        const xEdge = cx + side * (w * 0.06 + near * w * sideScale * 0.45) * pulse
        const yTop = vanishY - near * h * 0.5 * (0.7 + Math.sin(i + p * 4) * 0.08)
        const yBot = vanishY + near * h * 0.58
        const nextDepth = (i + 1 + ((walk * 0.5) % 1)) / segments
        const nz = Math.min(1, nextDepth * nextDepth)
        const nNear = 1 - nz
        const xEdge2 = cx + side * (w * 0.06 + nNear * w * sideScale * 0.45)
        const yTop2 = vanishY - nNear * h * 0.5 * (0.7 + Math.sin(i + 1 + p * 4) * 0.08)
        const yBot2 = vanishY + nNear * h * 0.58

        const r = Math.floor(12 + darkness * 28 + near * 20 + (side > 0 ? 8 : 0))
        const g = Math.floor(18 + darkness * 30 + near * 25)
        const b = Math.floor(35 + darkness * 40 + near * 50)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.beginPath()
        ctx.moveTo(xEdge, yTop)
        ctx.quadraticCurveTo(
          (xEdge + xEdge2) / 2 + side * near * 8,
          (yTop + yTop2) / 2 - near * 12,
          xEdge2,
          yTop2,
        )
        ctx.lineTo(xEdge2, yBot2)
        ctx.quadraticCurveTo((xEdge + xEdge2) / 2, (yBot + yBot2) / 2, xEdge, yBot)
        ctx.closePath()
        ctx.fill()

        if (i % 4 === 0 && near > 0.25) {
          ctx.strokeStyle = `rgba(120, 200, 255, ${0.06 + near * 0.12})`
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(xEdge - side * 4, yTop + (yBot - yTop) * 0.3)
          ctx.quadraticCurveTo(
            xEdge - side * 18 * near,
            yTop + (yBot - yTop) * 0.45,
            xEdge - side * 6,
            yTop + (yBot - yTop) * 0.6,
          )
          ctx.stroke()
        }
      }
    }
  }

  /** Soft world-spires — unfinished glowing spines, not hypostyle posts */
  private drawWorldSpires(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    vanishY: number,
    walk: number,
    p: number,
    time: number,
  ): void {
    const cols = 10
    for (let i = 0; i < cols; i++) {
      const phase = (i / cols + walk * 0.045) % 1
      const z = phase * phase
      const near = 1 - z
      if (near < 0.05) continue
      const side = i % 2 === 0 ? -1 : 1
      const x = cx + side * (w * 0.12 + near * w * 0.36)
      const colW = 4 + near * 22
      const top = vanishY - near * h * 0.52
      const bot = vanishY + near * h * 0.5

      const g = ctx.createLinearGradient(x - colW, 0, x + colW, 0)
      g.addColorStop(0, '#04060e')
      g.addColorStop(0.45, `rgb(${40 + near * 50}, ${50 + near * 70}, ${80 + near * 90})`)
      g.addColorStop(1, '#03040a')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x - colW * 0.25, top)
      ctx.quadraticCurveTo(x, top - near * 18, x + colW * 0.25, top)
      ctx.lineTo(x + colW * 0.45, bot)
      ctx.lineTo(x - colW * 0.45, bot)
      ctx.closePath()
      ctx.fill()

      // Soft biopolymer tip glow
      ctx.fillStyle = `rgba(180, 220, 255, ${0.08 + near * 0.2 + Math.sin(time + i) * 0.04})`
      ctx.beginPath()
      ctx.ellipse(x, top, colW * 0.7, 5 + near * 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Soft membrane curtain rushing past
    const cross = (walk * 0.1 + p * 2.2) % 1
    if (cross > 0.55 && cross < 0.95) {
      const depth = (cross - 0.55) / 0.4
      const near = 1 - depth * depth
      const y = vanishY + near * h * 0.03
      const half = near * w * 0.26
      const opening = near * w * 0.09
      ctx.fillStyle = `rgba(10, 16, 36, ${0.45 * near})`
      ctx.beginPath()
      ctx.moveTo(cx - half, y - near * 40)
      ctx.quadraticCurveTo(cx - opening * 1.4, y, cx - half, y + near * 50)
      ctx.lineTo(cx - half, y - near * 40)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx + half, y - near * 40)
      ctx.quadraticCurveTo(cx + opening * 1.4, y, cx + half, y + near * 50)
      ctx.fill()
      ctx.strokeStyle = `rgba(140, 190, 255, ${0.2 * near})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(cx, y, opening * 1.1, near * 48, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private drawChamberGate(
    ctx: CanvasRenderingContext2D,
    cx: number,
    vanishY: number,
    w: number,
    _h: number,
    p: number,
    time: number,
  ): void {
    const scale = 0.35 + p * 0.95
    const rw = 16 * scale + w * 0.01
    const rh = 36 * scale
    const x = cx
    const y = vanishY - rh * 0.12

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale * 0.55, scale * 0.55)
    ctx.globalAlpha = 0.22 + p * 0.5

    // Soft ring gate — portal of first light, not ankh
    ctx.strokeStyle = `rgba(240, 210, 140, ${0.45 + p * 0.35})`
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.ellipse(0, -rh * 0.2, rw * 0.55, rh * 0.45, 0, 0, Math.PI * 2)
    ctx.stroke()

    const glow = ctx.createRadialGradient(0, -rh * 0.15, 2, 0, -rh * 0.1, rw * 0.9)
    glow.addColorStop(0, `rgba(255, 240, 200, ${0.35 + Math.sin(time) * 0.08})`)
    glow.addColorStop(0.4, `rgba(120, 180, 255, 0.15)`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(0, -rh * 0.2, rw * 0.5, rh * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  /** Golden light-path — bricks of creative roadway */
  private drawLightPath(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    vanishY: number,
    p: number,
    time: number,
  ): void {
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.02, vanishY + 2)
    ctx.lineTo(cx - w * 0.3, h)
    ctx.lineTo(cx + w * 0.3, h)
    ctx.lineTo(cx + w * 0.02, vanishY + 2)
    ctx.closePath()
    const roadBed = ctx.createLinearGradient(0, vanishY, 0, h)
    roadBed.addColorStop(0, 'rgba(40, 35, 15, 0.15)')
    roadBed.addColorStop(1, 'rgba(20, 18, 8, 0.45)')
    ctx.fillStyle = roadBed
    ctx.fill()

    for (const b of this.bricks) {
      const rel = (b.depth - p * 0.85) / Math.max(0.15, 1 - p * 0.85)
      if (rel < 0 || rel > 1.15) continue
      const z = Math.max(0.02, Math.min(1, rel))
      const near = 1 - z * 0.92
      const y = vanishY + near * (h - vanishY) * 0.92
      const roadHalf = near * w * 0.28
      const brickW = (18 + near * 56) * (0.7 + Math.abs(b.lane) * 0.1)
      const brickH = 5 + near * 15
      const x =
        cx +
        b.lane * roadHalf * 0.55 +
        b.wobble * near * 20 +
        Math.sin(time + b.depth * 10) * 0.5

      const wet = b.wet
      const g = ctx.createLinearGradient(x - brickW / 2, y, x + brickW / 2, y + brickH)
      g.addColorStop(0, `rgba(${200 + wet * 40}, ${170 + wet * 30}, ${60}, ${0.5 + wet * 0.3})`)
      g.addColorStop(0.45, `rgba(245, 200, 80, ${0.65 + wet * 0.2})`)
      g.addColorStop(1, `rgba(160, 110, 40, ${0.35 + wet * 0.25})`)
      ctx.fillStyle = g

      ctx.beginPath()
      ctx.moveTo(x - brickW * 0.5, y)
      ctx.lineTo(x + brickW * 0.5, y)
      ctx.lineTo(x + brickW * 0.48, y + brickH)
      ctx.lineTo(x - brickW * 0.52, y + brickH)
      ctx.closePath()
      ctx.fill()

      if (wet > 0.35) {
        ctx.fillStyle = `rgba(255, 220, 120, ${wet * 0.4})`
        ctx.fillRect(x + brickW * 0.1, y + brickH, 2, 4 + wet * 10)
      }
    }
  }

  private drawNearVeil(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    walk: number,
    p: number,
    time: number,
  ): void {
    const pulse = 0.85 + Math.sin(walk * 0.55) * 0.08
    const lean = Math.sin(walk * 0.14 + time) * 0.02
    ctx.fillStyle = `rgba(4, 8, 20, ${0.78 * pulse})`
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(w * (0.13 + lean), 0)
    ctx.quadraticCurveTo(w * (0.05 + lean), h * 0.5, w * (0.02 + lean), h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(w, 0)
    ctx.lineTo(w * (0.87 - lean), 0)
    ctx.quadraticCurveTo(w * (0.95 - lean), h * 0.5, w * (0.98 - lean), h)
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()

    const lintel = ctx.createLinearGradient(0, 0, 0, h * 0.2)
    lintel.addColorStop(0, `rgba(0,0,0,${0.55 + p * 0.1})`)
    lintel.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lintel
    ctx.fillRect(0, 0, w, h * 0.22)

    void cx
  }
}
